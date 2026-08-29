#!/usr/bin/env python3
"""
Servidor HTTP Local com Hub de Sincronização em Tempo Real (LAN / Wi-Fi)
Plataforma de Apresentação HTML Interativa Sincronizada

Fornece:
1. Servidor de arquivos estáticos sem cache (no-cache headers).
2. Hub de eventos e estados de sessão (/api/sync) para sincronização instantânea
   entre Celulares e Computadores na mesma rede local, 100% offline e sem dependências externas.
"""

import os
import sys
import json
import time
import socket
import argparse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Memória central de sincronização em tempo real do servidor local
SERVER_STATE = {
    "sessions": {},      # sessionId -> { state: {}, events: [] }
    "max_events": 500
}

class LiveSyncHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativa cache para garantir que os celulares sempre recebam a versão mais recente dos scripts
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
        
        # Endpoint de Sincronização em Tempo Real
        if parsed.path == '/api/sync':
            qs = parse_qs(parsed.query)
            session_id = qs.get('session', ['SDWAN2026'])[0].strip().toUpperCase() if hasattr(str, 'toUpperCase') else qs.get('session', ['SDWAN2026'])[0].strip().upper()
            since_ts = int(qs.get('since', [0])[0])

            session_data = SERVER_STATE["sessions"].setdefault(session_id, {
                "state": {},
                "events": [],
                "questions": [],
                "votes": {},
                "presence": {}
            })

            # Filtra eventos novos desde o timestamp solicitado
            new_events = [e for e in session_data["events"] if e.get("timestamp", 0) > since_ts]

            response_data = {
                "sessionId": session_id,
                "serverTime": int(time.time() * 1000),
                "state": session_data["state"],
                "events": new_events,
                "questions": session_data["questions"],
                "votes": session_data["votes"],
                "presenceCount": len([p for p in session_data["presence"].values() if (time.time() * 1000 - p.get("lastPing", 0)) < 15000])
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

                session_data = SERVER_STATE["sessions"].setdefault(session_id, {
                    "state": {},
                    "events": [],
                    "questions": [],
                    "votes": {},
                    "presence": {}
                })

                event_record = {
                    "type": msg_type,
                    "sessionId": session_id,
                    "payload": payload,
                    "timestamp": now_ts
                }

                # Atualiza dados específicos conforme o tipo de mensagem
                if msg_type == 'SESSION_STATE_UPDATE':
                    session_data["state"].update(payload)
                elif msg_type == 'NEW_QUESTION':
                    q = payload.get('question')
                    if q:
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
                        # Evita voto duplicado pelo mesmo UID
                        uid = payload.get('uid')
                        if not any(v.get('uid') == uid for v in vote_list):
                            vote_list.append(payload)
                elif msg_type == 'RESET_POLL':
                    pid = payload.get('pollId')
                    if pid and pid in session_data["votes"]:
                        session_data["votes"][pid] = []
                elif msg_type == 'RESET_ALL_POLLS':
                    session_data["votes"] = {}
                elif msg_type == 'PRESENCE_PING':
                    uid = payload.get('uid')
                    if uid:
                        session_data["presence"][uid] = {
                            "alias": payload.get('alias', 'Participante'),
                            "isAuthenticated": payload.get('isAuthenticated', False),
                            "lastPing": now_ts
                        }

                # Registra evento na fila
                session_data["events"].append(event_record)
                if len(session_data["events"]) > SERVER_STATE["max_events"]:
                    session_data["events"] = session_data["events"][-SERVER_STATE["max_events"]:]

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "timestamp": now_ts}).encode('utf-8'))
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
        # Suprime logs repetitivos de polling
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
    print(" 📡 PLATAFORMA DE APRESENTAÇÃO ONLINE - SERVIDOR REALTIME ATIVO")
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
    print(" ⚡ Hub de Sincronização Local (/api/sync) ativo: Celulares e Telão sincronizados!")
    print(" Pressione Ctrl+C para encerrar o servidor.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Servidor encerrado.")
        httpd.server_close()

if __name__ == '__main__':
    main()
