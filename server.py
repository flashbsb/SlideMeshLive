#!/usr/bin/env python3
"""
Servidor HTTP Local com Hub de Sincronização em Tempo Real Sequencial (LAN / Wi-Fi)
Plataforma de Apresentação HTML Interativa Sincronizada
"""

import os
import sys
import json
import time
import re
import base64
import socket
import argparse
import threading
import queue
import socketserver

try:
    from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
except ImportError:
    from http.server import HTTPServer, SimpleHTTPRequestHandler
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
        daemon_threads = True

from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Memória central de sincronização em tempo real do servidor local
SERVER_STATE = {
    "sessions": {},
    "max_events": 1000
}
_STATE_LOCK = threading.Lock()
PRESENCE_TIMEOUT_MS = 30000  # Janela de timeout único para poda e contagem (30s)
BACKUP_FILE = os.environ.get("SLIDEMESH_BACKUP_FILE", ".session_backup.json")
PERSIST_ENABLED = False

# Gerenciador de Subscrições SSE por Sessão
SSE_SUBSCRIBERS = {}  # session_id -> Set[queue.Queue]
_SSE_LOCK = threading.Lock()

def broadcast_sse(session_id, event_type, data):
    """
    Despacha evento via SSE para todos os clientes conectados à sessão especificada.
    """
    with _SSE_LOCK:
        subscribers = list(SSE_SUBSCRIBERS.get(session_id, set()))

    if not subscribers:
        return

    payload = {
        "event": event_type,
        "data": data
    }

    for q in subscribers:
        try:
            q.put_nowait(payload)
        except (queue.Full, Exception):
            pass

def save_state_to_disk(filepath=None):
    """
    Salva o snapshot das sessões em disco de forma atômica utilizando arquivo temporário e os.replace.
    Possui fallback seguro para retenção apenas em memória caso o disco seja somente leitura.
    """
    target_path = filepath or BACKUP_FILE
    tmp_path = f"{target_path}.tmp"
    try:
        with _STATE_LOCK:
            clean_sessions = {}
            for sid, sdata in SERVER_STATE["sessions"].items():
                clean_sessions[sid] = {
                    "state": sdata.get("state", {}),
                    "events": sdata.get("events", []),
                    "questions": sdata.get("questions", []),
                    "votes": sdata.get("votes", {}),
                    "presence": {},  # Presença é efêmera por design
                    "last_event_id": sdata.get("last_event_id", 0)
                }
            data_to_save = {
                "version": "1.0.0",
                "timestamp": int(time.time() * 1000),
                "sessions": clean_sessions,
                "max_events": SERVER_STATE.get("max_events", 1000)
            }
            content = json.dumps(data_to_save, ensure_ascii=False, indent=2)

        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, target_path)
        return True
    except Exception as e:
        sys.stderr.write(f"[WARN] Falha na persistência atômica ({target_path}): {e}\n")
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        return False

def load_state_from_disk(filepath=None):
    """
    Restaura o estado das sessões a partir do snapshot salvo em disco.
    """
    target_path = filepath or BACKUP_FILE
    if not os.path.exists(target_path):
        return False
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "sessions" in data:
            with _STATE_LOCK:
                for sid, sdata in data["sessions"].items():
                    session_entry = SERVER_STATE["sessions"].setdefault(sid, {
                        "state": { "currentSlide": 0, "slideId": 1, "pollStatus": "open", "showResults": False },
                        "events": [],
                        "questions": [],
                        "votes": {},
                        "presence": {},
                        "last_event_id": 0
                    })
                    session_entry["state"] = sdata.get("state", session_entry["state"])
                    session_entry["events"] = sdata.get("events", [])
                    session_entry["questions"] = sdata.get("questions", [])
                    session_entry["votes"] = sdata.get("votes", {})
                    session_entry["presence"] = {}
                    session_entry["last_event_id"] = sdata.get("last_event_id", 0)
                if "max_events" in data:
                    SERVER_STATE["max_events"] = data["max_events"]
            return True
    except Exception as e:
        sys.stderr.write(f"[WARN] Falha ao restaurar snapshot em disco ({target_path}): {e}\n")
def import_presentation_files(data):
    """
    Processa a gravação atômica de uma nova apresentação importada:
    - Validação de schema (manifest, slides)
    - Prevenção de Path Traversal
    - Gravação atômica de manifest.json e slides.json
    - Decodificação e gravação de assets embutidos
    - Atualização atômica de presentations/catalog.json
    """
    if not isinstance(data, dict):
        raise ValueError("Payload de importação inválido: esperado objeto JSON.")

    manifest = data.get("manifest")
    slides = data.get("slides")
    assets = data.get("assets", [])

    if not isinstance(manifest, dict) or not isinstance(slides, list) or len(slides) == 0:
        raise ValueError("Apresentação precisa conter manifest válido e ao menos 1 slide.")

    raw_id = str(manifest.get("id", "")).strip().lower()
    slug = re.sub(r'[^a-z0-9_-]', '', raw_id)
    if not slug or len(slug) < 2:
        slug = f"apresentacao-{int(time.time())}"

    manifest["id"] = slug
    manifest["totalSlides"] = len(slides)
    manifest.setdefault("theme", {"accentColor": "#38bdf8", "background": "#0b0f19"})
    manifest.setdefault("security", {"mode": "public"})
    manifest.setdefault("defaultSession", "SES" + str(int(time.time()) % 9000 + 1000))
    manifest.setdefault("securityLabel", "Pública")
    manifest.setdefault("badgeClass", "badge-accent")

    presentations_root = os.path.abspath(os.path.join(BASE_DIR, "presentations"))
    target_dir = os.path.abspath(os.path.join(presentations_root, slug))

    # Proteção de segurança contra Path Traversal
    if not target_dir.startswith(presentations_root + os.sep) and target_dir != presentations_root:
        raise PermissionError("Tentativa de gravação fora do diretório presentations/ bloqueada.")

    assets_dir = os.path.join(target_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    # 1. Grava assets se houver
    for asset in assets:
        if isinstance(asset, dict) and "filename" in asset and "dataBase64" in asset:
            fname = os.path.basename(asset["filename"])
            if not fname:
                continue
            b64_str = str(asset["dataBase64"])
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            try:
                asset_bytes = base64.b64decode(b64_str)
                asset_path = os.path.join(assets_dir, fname)
                with open(asset_path, "wb") as af:
                    af.write(asset_bytes)
            except Exception as e:
                sys.stderr.write(f"[WARN] Falha ao gravar asset {fname}: {e}\n")

    # 2. Grava manifest.json atomicamente
    manifest_path = os.path.join(target_dir, "manifest.json")
    manifest_tmp = manifest_path + ".tmp"
    with open(manifest_tmp, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, ensure_ascii=False, indent=2)
        mf.flush()
        os.fsync(mf.fileno())
    os.replace(manifest_tmp, manifest_path)

    # 3. Grava slides.json atomicamente
    slides_payload = {"slides": slides}
    slides_path = os.path.join(target_dir, "slides.json")
    slides_tmp = slides_path + ".tmp"
    with open(slides_tmp, "w", encoding="utf-8") as sf:
        json.dump(slides_payload, sf, ensure_ascii=False, indent=2)
        sf.flush()
        os.fsync(sf.fileno())
    os.replace(slides_tmp, slides_path)

    # 4. Atualiza presentations/catalog.json atomicamente
    catalog_path = os.path.join(presentations_root, "catalog.json")
    with _STATE_LOCK:
        catalog_data = {"version": "1.0.0", "presentations": []}
        if os.path.exists(catalog_path):
            try:
                with open(catalog_path, "r", encoding="utf-8") as cf:
                    catalog_data = json.load(cf)
            except Exception:
                pass

        catalog_presentations = catalog_data.setdefault("presentations", [])
        catalog_entry = {
            "id": slug,
            "code": manifest.get("code", slug.upper()),
            "title": manifest.get("title", slug),
            "subtitle": manifest.get("subtitle", ""),
            "description": manifest.get("description", ""),
            "defaultSession": manifest.get("defaultSession", "SES2026"),
            "totalSlides": len(slides),
            "securityMode": manifest.get("security", {}).get("mode", "public"),
            "securityLabel": manifest.get("securityLabel", "Pública"),
            "badgeClass": manifest.get("badgeClass", "badge-accent")
        }

        # Se já existe no catálogo, atualiza; se não, insere no topo
        existing_idx = next((i for i, p in enumerate(catalog_presentations) if p.get("id") == slug), None)
        if existing_idx is not None:
            catalog_presentations[existing_idx] = catalog_entry
        else:
            catalog_presentations.insert(0, catalog_entry)

        catalog_tmp = catalog_path + ".tmp"
        with open(catalog_tmp, "w", encoding="utf-8") as cf:
            json.dump(catalog_data, cf, ensure_ascii=False, indent=2)
            cf.flush()
            os.fsync(cf.fileno())
        os.replace(catalog_tmp, catalog_path)

    return {
        "slug": slug,
        "totalSlides": len(slides),
        "manifest": manifest
    }

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

        # Endpoint de Streaming SSE em Tempo Real (Server-Sent Events)
        if parsed.path == '/api/events':
            qs = parse_qs(parsed.query)
            session_id = qs.get('session', ['SDWAN2026'])[0].strip().upper()
            since_id = int(qs.get('since_id', [0])[0])

            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache, no-transform, no-store')
            self.send_header('Connection', 'keep-alive')
            self.send_header('X-Accel-Buffering', 'no')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            client_queue = queue.Queue(maxsize=200)
            with _SSE_LOCK:
                if session_id not in SSE_SUBSCRIBERS:
                    SSE_SUBSCRIBERS[session_id] = set()
                SSE_SUBSCRIBERS[session_id].add(client_queue)

            # Envia snapshot inicial de sincronização
            with _STATE_LOCK:
                session_data = SERVER_STATE["sessions"].setdefault(session_id, {
                    "state": { "currentSlide": 0, "slideId": 1, "pollStatus": "open", "showResults": False },
                    "events": [],
                    "questions": [],
                    "votes": {},
                    "presence": {},
                    "last_event_id": 0
                })
                now_ms = int(time.time() * 1000)
                init_payload = {
                    "sessionId": session_id,
                    "serverTime": now_ms,
                    "lastEventId": session_data["last_event_id"],
                    "state": session_data["state"],
                    "questions": session_data["questions"],
                    "votes": session_data["votes"],
                    "presenceCount": len(session_data["presence"])
                }
                if since_id > 0:
                    init_payload["events"] = [e for e in session_data["events"] if e.get("id", 0) > since_id]

            try:
                init_msg = f"event: sync\ndata: {json.dumps(init_payload, ensure_ascii=False)}\n\n".encode('utf-8')
                self.wfile.write(init_msg)
                self.wfile.flush()

                while True:
                    try:
                        msg = client_queue.get(timeout=15.0)
                        ev_name = msg.get("event", "message")
                        ev_data = json.dumps(msg.get("data", {}), ensure_ascii=False)
                        chunk = f"event: {ev_name}\ndata: {ev_data}\n\n".encode('utf-8')
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    except queue.Empty:
                        # Heartbeat para manter socket TCP ativo
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, socket.error, Exception):
                pass
            finally:
                with _SSE_LOCK:
                    if session_id in SSE_SUBSCRIBERS:
                        SSE_SUBSCRIBERS[session_id].discard(client_queue)
                        if not SSE_SUBSCRIBERS[session_id]:
                            del SSE_SUBSCRIBERS[session_id]
            return
        
        # Endpoint de Sincronização em Tempo Real Sequencial (Polling Delta Fallback)
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
                stale_uids = [uid for uid, p in session_data["presence"].items() if (now_ms - p.get("lastPing", 0)) >= PRESENCE_TIMEOUT_MS]
                for uid in stale_uids:
                    del session_data["presence"][uid]

                active_presence = len(session_data["presence"])

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

                    # B11 / ND05: PRESENCE_PING atualiza presença sem poluir a fila de eventos e sem segurar lock no I/O
                    if msg_type == 'PRESENCE_PING':
                        uid = payload.get('uid')
                        if uid:
                            session_data["presence"][uid] = {
                                "alias": payload.get('alias', 'Participante'),
                                "isAuthenticated": payload.get('isAuthenticated', False),
                                "lastPing": now_ts
                            }
                        event_id = 0
                    elif msg_type == 'PRESENCE_LEAVE':
                        # NE03: remove participante imediatamente no logout
                        uid = payload.get('uid')
                        if uid and uid in session_data["presence"]:
                            del session_data["presence"][uid]
                        event_id = 0
                    else:
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
                            if new_status == 'clear_featured':
                                for q in session_data["questions"]:
                                    if q.get('status') == 'featured':
                                        q['status'] = 'approved'
                            elif qid:
                                for q in session_data["questions"]:
                                    if q.get('id') == qid:
                                        if new_status == 'deleted':
                                            session_data["questions"].remove(q)
                                        else:
                                            if new_status and new_status != 'answered_toggle':
                                                q['status'] = new_status
                                            if 'answered' in payload:
                                                q['answered'] = payload['answered']
                                        break
                        elif msg_type == 'CLEAR_ALL_QUESTIONS':
                            session_data["questions"] = []
                        elif msg_type == 'QUESTION_UPVOTE':
                            qid = payload.get('questionId')
                            uid = payload.get('uid')
                            if qid and uid:
                                for q in session_data["questions"]:
                                    if q.get('id') == qid:
                                        upvoted_by = q.setdefault('upvotedBy', [])
                                        if uid in upvoted_by:
                                            upvoted_by.remove(uid)
                                        else:
                                            upvoted_by.append(uid)
                                        q['upvotes'] = len(upvoted_by)
                                        break
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

                    # Snapshot dos dados sob lock para broadcasting seguro
                    current_state = dict(session_data["state"])
                    current_questions = list(session_data["questions"])
                    current_votes = dict(session_data["votes"])
                    current_presence_count = len(session_data["presence"])
                    dispatched_event = dict(event_record) if event_id > 0 else None

                # Broadcasting instantâneo SSE para todos os clientes conectados
                if msg_type in ('PRESENCE_PING', 'PRESENCE_LEAVE'):
                    broadcast_sse(session_id, "presence", {"presenceCount": current_presence_count})
                else:
                    if msg_type in ('SESSION_STATE_UPDATE', 'SESSION_UPDATE'):
                        broadcast_sse(session_id, "state", current_state)
                    elif msg_type in ('NEW_QUESTION', 'QUESTION_STATUS_CHANGE', 'CLEAR_ALL_QUESTIONS', 'QUESTION_UPVOTE'):
                        broadcast_sse(session_id, "questions", current_questions)
                    elif msg_type in ('VOTE_CAST', 'RESET_POLL', 'RESET_ALL_POLLS', 'VOTE_RESET'):
                        broadcast_sse(session_id, "votes", current_votes)

                    if dispatched_event:
                        broadcast_sse(session_id, "event", dispatched_event)

                # Salva snapshot atômico em disco se persistência estiver ativa
                if PERSIST_ENABLED and msg_type not in ('PRESENCE_PING', 'PRESENCE_LEAVE'):
                    save_state_to_disk()

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

        elif parsed.path == '/api/presentations/import':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            try:
                data = json.loads(body)
                import_res = import_presentation_files(data)
                slug = import_res["slug"]
                manifest = import_res["manifest"]

                response_data = {
                    "success": True,
                    "presentationId": slug,
                    "totalSlides": import_res["totalSlides"],
                    "presenterUrl": f"/presenter/?presentation={slug}&session={manifest.get('defaultSession', 'SES2026')}",
                    "audienceUrl": f"/audience/?presentation={slug}&session={manifest.get('defaultSession', 'SES2026')}",
                    "adminUrl": f"/admin/?presentation={slug}&session={manifest.get('defaultSession', 'SES2026')}",
                    "message": "Apresentação importada e registrada com sucesso!"
                }

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(response_data).encode('utf-8'))
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
    global PERSIST_ENABLED, BACKUP_FILE
    parser = argparse.ArgumentParser(description='Servidor Local com Sincronização para Apresentação Online')
    parser.add_argument('--port', '-p', type=int, default=8000, help='Porta HTTP (padrão: 8000)')
    parser.add_argument('--dir', '-d', type=str, default='.', help='Diretório raiz (padrão: .)')
    parser.add_argument('--persist', action='store_true', help='Habilita persistência e restauração de sessões em disco (.session_backup.json)')
    parser.add_argument('--backup-file', type=str, default='.session_backup.json', help='Caminho do arquivo de snapshot (padrão: .session_backup.json)')
    args = parser.parse_args()

    os.chdir(args.dir)
    port = args.port
    local_ip = get_local_ip()

    if args.persist:
        PERSIST_ENABLED = True
        BACKUP_FILE = args.backup_file
        if load_state_from_disk(BACKUP_FILE):
            print(f" 💾 Snapshot de sessões anteriores restaurado com sucesso ({BACKUP_FILE})")

    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True

    print("=" * 72)
    print(" 📡 SlideMeshLive — Servidor de Sincronização em Tempo Real (LAN / Wi-Fi)")
    print("=" * 72)
    print(f" 💻 Acesso Local no Computador (Navegador):")
    print(f"    Portal Inicial:     http://localhost:{port}/")
    print(f"    Telão Apresentador: http://localhost:{port}/presenter/?presentation=sdwan-cpe-unificado")
    print(f"    Mesa Técnica/Admin: http://localhost:{port}/admin/?presentation=sdwan-cpe-unificado")
    print("")
    print(f" 📱 Acesso de Smartphones pelo Celular (Mesmo Wi-Fi / Rede Local):")
    print(f"    http://{local_ip}:{port}/")
    print(f"    Link Direto Celular: http://{local_ip}:{port}/audience/?presentation=sdwan-cpe-unificado&session=SDWAN2026")
    print(f" 📦 Repositório GitHub:   https://github.com/flashbsb/SlideMeshLive")
    if PERSIST_ENABLED:
        print(f" 🛡️ Persistência em Disco: ATIVA ({BACKUP_FILE})")
    print("=" * 72)
    print(" ⚡ Hub Sequencial (/api/sync) ativo: Celulares e Telão sincronizados!")
    print(" Pressione Ctrl+C para encerrar o servidor.\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Encerrando servidor...")
        if PERSIST_ENABLED:
            save_state_to_disk(BACKUP_FILE)
            print(" [✓] Estado das sessões salvo em disco.")
        httpd.server_close()
        print("[+] Servidor encerrado.")

if __name__ == '__main__':
    main()
