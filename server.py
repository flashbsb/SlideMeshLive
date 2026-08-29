#!/usr/bin/env python3
"""
Servidor HTTP Local com Hub de Sincronização em Tempo Real Sequencial (LAN / Wi-Fi)
Plataforma de Apresentação HTML Interativa Sincronizada
"""

import os
import sys
import json
import time
import socket
import argparse
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Memória central de sincronização em tempo real do servidor local
SERVER_STATE = {
    "sessions": {},
    "max_events": 1000
}
_STATE_LOCK = threading.Lock()

class LiveSyncHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativa cache para garantir entrega em tempo real de assets
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        
        # Endpoint de Sincronização em Tempo Real Sequencial
        if parsed.path == '/api/sync':
            qs = parse_qs(parsed.query)
            session_id = qs.get('session', ['SDWAN2026'])[0].strip().upper()
            since_id = int(qs.get('since_id', [0])[0])

            with _STATE_LOCK:
                session_data = SERVER_STATE["sessions"].setdefault(session_id, {
                    "state": { "currentSlide": 0, "slideId": 1, "pollStatus": "open", "showResults": False },
                    "events": [],
                    "questions": [],
                    "votes": {},
                    "presence": {},
                    "last_event_id": 0
                })

                # Filtra eventos novos com ID sequencial maior que since_id
                new_events = [e for e in session_data["events"] if e.get("id", 0) > since_id]

                now_ms = int(time.time() * 1000)
                active_presence = len([p for p in session_data["presence"].values() if (now_ms - p.get("lastPing", 0)) < 15000])

                response_data = {
                    "sessionId": session_id,
                    "serverTime": now_ms,
                    "lastEventId": session_data["last_event_id"],
                    "state": session_data["state"],
                    "events": new_events,
                    "questions": session_data["questions"],
                    "votes": session_data["votes"],
                    "presenceCount": active_presence
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return

        # Servidor de arquivos estáticos padrão
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        
        if parsed.path == '/api/sync':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                raw_sid = data.get('sessionId', 'SDWAN2026')
                session_id = raw_sid.strip().upper()
                msg_type = data.get('type')
                payload = data.get('payload', {})
                now_ts = int(time.time() * 1000)

                with _STATE_LOCK:
                    session_data = SERVER_STATE["sessions"].setdefault(session_id, {
                        "state": { "currentSlide": 0, "slideId": 1, "pollStatus": "open", "showResults": False },
                        "events": [],
                        "questions": [],
                        "votes": {},
                        "presence": {},
                        "last_event_id": 0
                    })

                    # B11: PRESENCE_PING atualiza presença sem poluir a fila de eventos
                    if msg_type == 'PRESENCE_PING':
                        uid = payload.get('uid')
                        if uid:
                            session_data["presence"][uid] = {
                                "alias": payload.get('alias', 'Participante'),
                                "isAuthenticated": payload.get('isAuthenticated', False),
                                "lastPing": now_ts
                            }
                        self.send_response(200)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps({"success": True, "eventId": 0, "timestamp": now_ts}).encode('utf-8'))
                        return

                    session_data["last_event_id"] += 1
                    event_id = session_data["last_event_id"]

                    event_record = {
                        "id": event_id,
                        "type": msg_type,
                        "sessionId": session_id,
                        "payload": payload,
                        "timestamp": now_ts
                    }

                    # Atualiza memória de estado conforme o tipo de mensagem
                    if msg_type in ('SESSION_STATE_UPDATE', 'SESSION_UPDATE'):
                        session_data["state"].update(payload)
                    elif msg_type == 'NEW_QUESTION':
                        q = payload.get('question')
                        if q and not any(existing.get('id') == q.get('id') for existing in session_data["questions"]):
                            session_data["questions"].append(q)
                    elif msg_type == 'QUESTION_STATUS_CHANGE':
                        qid = payload.get('questionId')
                        new_status = payload.get('status')
                        for q in session_data["questions"]:
                            if q.get('id') == qid:
                                if new_status == 'deleted':
                                    session_data["questions"].remove(q)
                                else:
                                    q['status'] = new_status
                                    if 'answered' in payload:
                                        q['answered'] = payload['answered']
                                break
                    elif msg_type == 'CLEAR_ALL_QUESTIONS':
                        session_data["questions"] = []
                    elif msg_type == 'VOTE_CAST':
                        pid = payload.get('pollId')
                        if pid:
                            vote_list = session_data["votes"].setdefault(pid, [])
                            uid = payload.get('uid')
                            if not any(v.get('uid') == uid for v in vote_list):
                                vote_list.append(payload)
                    elif msg_type in ('RESET_POLL', 'VOTE_RESET'):
                        pid = payload.get('pollId')
                        if pid and pid in session_data["votes"]:
                            session_data["votes"][pid] = []
                        elif not pid:
                            session_data["votes"] = {}
                    elif msg_type == 'RESET_ALL_POLLS':
                        session_data["votes"] = {}
                    elif msg_type == 'USER_BLOCKED_STATUS':
                        pass

                    # Adiciona na fila sequencial
                    session_data["events"].append(event_record)
                    if len(session_data["events"]) > SERVER_STATE["max_events"]:
                        session_data["events"] = session_data["events"][-SERVER_STATE["max_events"]:]

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "eventId": event_id, "timestamp": now_ts}).encode('utf-8'))
                return
            except Exception as err:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(err)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        if len(args) > 0 and '/api/sync' in str(args[0]):
            return
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]}\n")

def get_local_ip():
    """Descobre o endereço IP da máquina na rede local."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    parser = argparse.ArgumentParser(description='Servidor Local com Sincronização para Apresentação Online')
    parser.add_argument('--port', '-p', type=int, default=8000, help='Porta HTTP (padrão: 8000)')
    parser.add_argument('--dir', '-d', type=str, default='.', help='Diretório raiz (padrão: .)')
    args = parser.parse_args()

    os.chdir(args.dir)
    port = args.port
    local_ip = get_local_ip()

    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, LiveSyncHTTPRequestHandler)

    print("=" * 72)
    print(" 📡 PLATAFORMA DE APRESENTAÇÃO ONLINE - SERVIDOR REALTIME SEQUENCIAL")
    print("=" * 72)
    print(f" 💻 Acesso Local no Computador (Navegador):")
    print(f"    Portal Inicial:     http://localhost:{port}/")
    print(f"    Telão Apresentador: http://localhost:{port}/presenter/?presentation=sdwan-cpe-unificado")
    print(f"    Mesa Técnica/Admin: http://localhost:{port}/admin/?presentation=sdwan-cpe-unificado")
    print("")
    print(f" 📱 Acesso de Smartphones pelo Celular (Mesmo Wi-Fi / Rede Local):")
    print(f"    http://{local_ip}:{port}/")
    print(f"    Link Direto Celular: http://{local_ip}:{port}/audience/?presentation=sdwan-cpe-unificado&session=SDWAN2026")
    print("=" * 72)
    print(" ⚡ Hub Sequencial (/api/sync) ativo: Celulares e Telão sincronizados!")
    print(" Pressione Ctrl+C para encerrar o servidor.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Servidor encerrado.")
        httpd.server_close()

if __name__ == '__main__':
    main()
