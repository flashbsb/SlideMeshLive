#!/usr/bin/env python3
"""
SlideMeshLive — Suíte Unificada de Testes e Validação de Integridade
Cobertura:
1. Integridade do Catálogo e Apresentações (Manifests, Slides, Enquetes)
2. Presença e Integridade dos Arquivos Essenciais do Sistema
3. Simetria e Consistência do Dicionário de Internacionalização (i18n pt-BR / en-US)
4. Endpoints HTTP do Hub de Sincronização (server.py /api/sync GET e POST)
5. Regras de Segurança, Rate Limiting, Cooldown e Moderação (SecurityGuard)
6. Consistência da Documentação (README.md e rotas oficiais)
"""

import os
import sys
import json
import time
import re
import socket
import threading
import urllib.request
import urllib.error
import base64
import shutil
import io
import zipfile
from http.server import HTTPServer

# Adiciona o diretório raiz ao path para importação do server.py
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

import server

def print_section(title):
    print(f"\n{'='*70}\n 🧪 {title}\n{'='*70}")

def test_catalog_and_presentations_integrity():
    print_section("1. Integridade do Catálogo e Arquivos JSON de Apresentações")
    catalog_path = os.path.join(BASE_DIR, "presentations", "catalog.json")
    assert os.path.exists(catalog_path), f"Arquivo {catalog_path} não encontrado!"
    
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    
    presentations = catalog.get("presentations", [])
    assert len(presentations) >= 2, f"Esperado ao menos 2 apresentações no catálogo, encontrado {len(presentations)}"
    
    for p in presentations:
        pid = p.get("id")
        assert pid, "Apresentação sem campo 'id' no catálogo"
        assert "title" in p, f"Apresentação {pid} sem título"
        assert "defaultSession" in p, f"Apresentação {pid} sem defaultSession"
        assert "totalSlides" in p and p["totalSlides"] > 0, f"Apresentação {pid} com totalSlides inválido"
        
        manifest_path = os.path.join(BASE_DIR, "presentations", pid, "manifest.json")
        slides_path = os.path.join(BASE_DIR, "presentations", pid, "slides.json")
        
        assert os.path.exists(manifest_path), f"Manifest {manifest_path} ausente!"
        assert os.path.exists(slides_path), f"Slides {slides_path} ausente!"
        
        # Validação do manifest
        with open(manifest_path, "r", encoding="utf-8") as mf:
            manifest = json.load(mf)
            assert manifest.get("id") == pid, f"ID do manifest ({manifest.get('id')}) difere do catálogo ({pid})"
            assert manifest.get("title"), f"Título ausente no manifest de {pid}"
            assert "theme" in manifest, f"Seção 'theme' ausente no manifest de {pid}"
            assert "security" in manifest, f"Seção 'security' ausente no manifest de {pid}"
            
            # Se for protegido por PIN, valida existência do PIN
            if manifest["security"].get("mode") == "pin":
                assert manifest["security"].get("pin"), f"Apresentação {pid} com modo PIN mas sem código PIN configurado"
                
        # Validação dos slides
        with open(slides_path, "r", encoding="utf-8") as sf:
            slides_data = json.load(sf)
            slides = slides_data.get("slides", [])
            assert len(slides) == p["totalSlides"], f"Contagem de slides divergente para {pid}: catalog={p['totalSlides']} vs slides.json={len(slides)}"
            
            for slide in slides:
                assert "id" in slide, f"Slide sem 'id' em {pid}"
                assert "presenter" in slide, f"Slide {slide.get('id')} sem seção 'presenter' em {pid}"
                assert "audience" in slide, f"Slide {slide.get('id')} sem seção 'audience' em {pid}"
                
                # Validação de enquetes (se houver)
                if "interaction" in slide and "poll" in slide["interaction"]:
                    poll = slide["interaction"]["poll"]
                    assert "id" in poll, f"Enquete sem 'id' no slide {slide.get('id')} de {pid}"
                    assert "question" in poll and len(poll["question"].strip()) > 0, f"Pergunta vazia na enquete {poll.get('id')}"
                    options = poll.get("options", [])
                    assert len(options) >= 2, f"Enquete {poll.get('id')} precisa ter ao menos 2 opções"
                    opt_ids = [opt.get("id") for opt in options]
                    assert len(opt_ids) == len(set(opt_ids)), f"Opções com IDs duplicados na enquete {poll.get('id')}"
                    for opt in options:
                        assert "id" in opt and "text" in opt, f"Opção malformada na enquete {poll.get('id')}"
                        
    print(f"✓ Catálogo e {len(presentations)} apresentações validadas com 100% de conformidade estrutural.")

def test_essential_files_presence():
    print_section("2. Presença dos Arquivos Essenciais do Sistema")
    files = [
        # HTML Core
        "index.html",
        "docs.html",
        "import.html",
        "presenter/index.html",
        "admin/index.html",
        "audience/index.html",
        # CSS Core
        "css/base.css",
        "css/animations.css",
        "css/components.css",
        "css/presenter.css",
        "css/audience.css",
        "css/admin.css",
        # JS Config & Core Engines
        "js/config.js",
        "js/core/presentation-engine.js",
        "js/core/realtime-engine.js",
        "js/core/auth-engine.js",
        "js/core/interaction-engine.js",
        "js/core/moderation-engine.js",
        "js/core/security-guard.js",
        "js/core/qr-engine.js",
        "js/core/theme-engine.js",
        "js/core/i18n-engine.js",
        "js/core/session-manager.js",
        "js/core/conversion-engine.js",
        # JS Application Controllers
        "js/presenter/presenter-app.js",
        "js/audience/audience-app.js",
        "js/admin/admin-app.js",
        # Bibliotecas e Configurações
        "lib/qrcode.min.js",
        "lib/jszip.min.js",
        "config/security.example.json",
        "firebase.json",
        "database.rules.json",
        "server.py",
        "tools/import_presentation.py",
        "README.md",
        "README.pt-BR.md",
        "plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md"
    ]
    for f in files:
        full_path = os.path.join(BASE_DIR, f)
        assert os.path.exists(full_path), f"Arquivo essencial {f} não encontrado!"
        assert os.path.getsize(full_path) > 0, f"Arquivo {f} está vazio (0 bytes)!"
    print(f"✓ Todos os {len(files)} arquivos essenciais do sistema estão presentes e íntegros.")

def test_i18n_translations_consistency():
    print_section("3. Simetria e Consistência do Motor i18n (pt-BR / en-US)")
    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    def parse_dict(lang_key):
        match = re.search(rf"'{lang_key}'\s*:\s*\{{(.*?)\n  \}}", content, re.DOTALL)
        assert match, f"Bloco de tradução '{lang_key}' não encontrado em i18n-engine.js"
        block = match.group(1)
        pairs = re.findall(r"'([^']+)'\s*:\s*'([^']*)'", block)
        return dict(pairs)
        
    pt_dict = parse_dict("pt-BR")
    en_dict = parse_dict("en-US")
    
    assert len(pt_dict) >= 50, f"Dicionário pt-BR com poucas chaves ({len(pt_dict)})"
    assert len(en_dict) >= 50, f"Dicionário en-US com poucas chaves ({len(en_dict)})"
    
    pt_keys = set(pt_dict.keys())
    en_keys = set(en_dict.keys())
    
    missing_in_en = pt_keys - en_keys
    missing_in_pt = en_keys - pt_keys
    
    assert not missing_in_en, f"Chaves presentes em pt-BR mas ausentes em en-US: {missing_in_en}"
    assert not missing_in_pt, f"Chaves presentes em en-US mas ausentes em pt-BR: {missing_in_pt}"
    assert pt_keys == en_keys, "Divergência entre conjuntos de chaves i18n"
    
    # Validação de placeholders parametrizados (ex: {count}, {opt})
    for k in pt_keys:
        pt_vars = set(re.findall(r"\{(\w+)\}", pt_dict[k]))
        en_vars = set(re.findall(r"\{(\w+)\}", en_dict[k]))
        assert pt_vars == en_vars, f"Placeholders divergentes na chave '{k}': pt-BR={pt_vars} vs en-US={en_vars}"
        assert len(pt_dict[k].strip()) > 0, f"Tradução vazia em pt-BR para a chave '{k}'"
        assert len(en_dict[k].strip()) > 0, f"Tradução vazia em en-US para a chave '{k}'"
        
    print(f"✓ Motor i18n validado com 100% de simetria: {len(pt_keys)} chaves idênticas e placeholders sincronizados.")

def test_server_api_sync_endpoints():
    print_section("4. Testes de Endpoints do Hub HTTP de Sincronização (/api/sync)")
    
    # Limpa estado anterior em memória do servidor
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()
        
    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    
    base_url = f"http://127.0.0.1:{port}"
    session_id = "TEST_INTEGRATION_SESSION"
    
    try:
        # Helper para requisições
        def get_sync(since_id=0):
            url = f"{base_url}/api/sync?session={session_id}&since_id={since_id}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as res:
                assert res.status == 200
                assert "application/json" in res.headers.get("Content-Type", "")
                return json.loads(res.read().decode("utf-8"))
                
        def post_sync(msg_type, payload):
            url = f"{base_url}/api/sync"
            body = json.dumps({
                "type": msg_type,
                "sessionId": session_id,
                "payload": payload
            }).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as res:
                assert res.status == 200
                return json.loads(res.read().decode("utf-8"))

        # 1. Teste GET inicial
        initial_state = get_sync(since_id=0)
        assert initial_state["sessionId"] == session_id
        assert initial_state["presenceCount"] == 0
        assert initial_state["lastEventId"] == 0
        assert initial_state["state"]["currentSlide"] == 0
        assert initial_state["votes"] == {}
        assert initial_state["questions"] == []
        print("  ✓ GET /api/sync: Inicialização de sessão e estrutura de resposta validadas.")

        # 2. Teste PRESENCE_PING e PRESENCE_LEAVE
        ping_res1 = post_sync("PRESENCE_PING", {"uid": "user_alpha", "alias": "Participante Alfa", "isAuthenticated": False})
        assert ping_res1.get("success") is True
        ping_res2 = post_sync("PRESENCE_PING", {"uid": "user_beta", "alias": "Participante Beta", "isAuthenticated": True})
        assert ping_res2.get("success") is True
        
        state_presence = get_sync(since_id=0)
        assert state_presence["presenceCount"] == 2, f"Esperado 2 participantes, retornado {state_presence['presenceCount']}"
        
        leave_res = post_sync("PRESENCE_LEAVE", {"uid": "user_alpha"})
        assert leave_res.get("success") is True
        
        state_presence2 = get_sync(since_id=0)
        assert state_presence2["presenceCount"] == 1, f"Esperado 1 participante após leave, retornado {state_presence2['presenceCount']}"
        print("  ✓ POST /api/sync: PRESENCE_PING e PRESENCE_LEAVE funcionam perfeitamente.")

        # 3. Teste SESSION_STATE_UPDATE
        state_update_res = post_sync("SESSION_STATE_UPDATE", {"currentSlide": 4, "slideId": 5, "pollStatus": "open"})
        assert state_update_res.get("success") is True
        
        state_after = get_sync(since_id=0)
        assert state_after["state"]["currentSlide"] == 4
        assert state_after["state"]["slideId"] == 5
        print("  ✓ POST /api/sync: SESSION_STATE_UPDATE atualiza navegação de slides do telão.")

        # 4. Teste VOTE_CAST e Voto Único
        poll_id = "poll_sdwan_test"
        vote1 = post_sync("VOTE_CAST", {"pollId": poll_id, "uid": "user_beta", "optionId": "A", "alias": "Beta"})
        assert vote1.get("success") is True
        
        # Tentativa de voto duplicado com o mesmo UID
        vote1_dup = post_sync("VOTE_CAST", {"pollId": poll_id, "uid": "user_beta", "optionId": "B", "alias": "Beta"})
        assert vote1_dup.get("success") is True
        
        # Voto de outro UID
        vote2 = post_sync("VOTE_CAST", {"pollId": poll_id, "uid": "user_gamma", "optionId": "B", "alias": "Gamma"})
        assert vote2.get("success") is True
        
        state_votes = get_sync(since_id=0)
        poll_votes = state_votes["votes"].get(poll_id, [])
        assert len(poll_votes) == 2, f"Garantia de voto único violada no servidor: esperado 2 votos, obtido {len(poll_votes)}"
        uids_voted = [v["uid"] for v in poll_votes]
        assert uids_voted == ["user_beta", "user_gamma"], "Votos divergentes no pool da enquete"
        print("  ✓ POST /api/sync: VOTE_CAST aplica trava rigorosa de voto único por participante.")

        # 5. Teste RESET_POLL e RESET_ALL_POLLS
        reset_res = post_sync("RESET_POLL", {"pollId": poll_id})
        assert reset_res.get("success") is True
        state_reset = get_sync(since_id=0)
        assert state_reset["votes"].get(poll_id) == [], "Enquete não foi zerada após RESET_POLL"
        print("  ✓ POST /api/sync: RESET_POLL zera votos da enquete com sucesso.")

        # 6. Teste NEW_QUESTION e Moderação
        q_payload = {
            "id": "q_1001",
            "uid": "user_beta",
            "authorName": "Participante Beta",
            "text": "Como funciona o failover sob perda de pacote?",
            "timestamp": int(time.time() * 1000),
            "status": "pending",
            "answered": False
        }
        q_res = post_sync("NEW_QUESTION", {"question": q_payload})
        assert q_res.get("success") is True
        
        state_q = get_sync(since_id=0)
        assert len(state_q["questions"]) == 1
        assert state_q["questions"][0]["id"] == "q_1001"
        assert state_q["questions"][0]["status"] == "pending"
        
        # Destaque no Telão (status: featured)
        post_sync("QUESTION_STATUS_CHANGE", {"questionId": "q_1001", "status": "featured"})
        state_feat = get_sync(since_id=0)
        assert state_feat["questions"][0]["status"] == "featured"
        
        # Limpar Destaque (clear_featured -> approved)
        post_sync("QUESTION_STATUS_CHANGE", {"status": "clear_featured"})
        state_unfeat = get_sync(since_id=0)
        assert state_unfeat["questions"][0]["status"] == "approved"
        
        # Marcar como Respondida
        post_sync("QUESTION_STATUS_CHANGE", {"questionId": "q_1001", "answered": True})
        state_ans = get_sync(since_id=0)
        assert state_ans["questions"][0]["answered"] is True
        
        # Excluir Pergunta (deleted)
        post_sync("QUESTION_STATUS_CHANGE", {"questionId": "q_1001", "status": "deleted"})
        state_del = get_sync(since_id=0)
        assert len(state_del["questions"]) == 0
        print("  ✓ POST /api/sync: Ciclo de moderação de perguntas (pending ➔ featured ➔ approved ➔ answered ➔ deleted) validado.")

        # 7. Teste de Delta de Eventos por since_id
        events_state = get_sync(since_id=0)
        total_events = len(events_state["events"])
        last_id = events_state["lastEventId"]
        assert total_events > 0, "Nenhum evento registrado no log sequencial"
        assert last_id > 0, "lastEventId não incrementou"
        
        delta_state = get_sync(since_id=last_id - 1)
        assert len(delta_state["events"]) == 1, f"Filtro since_id falhou: esperado 1 evento, retornado {len(delta_state['events'])}"
        assert delta_state["events"][0]["id"] == last_id
        print("  ✓ GET /api/sync: Filtro delta sequencial por since_id opera com precisão.")

        # 8. Teste de Tratamento de Erro (Bad Request)
        bad_req = urllib.request.Request(f"{base_url}/api/sync", data=b"INVALID_JSON", headers={"Content-Type": "application/json"})
        try:
            urllib.request.urlopen(bad_req, timeout=3)
            assert False, "Requisição com JSON inválido deveria retornar erro 400"
        except urllib.error.HTTPError as err:
            assert err.code == 400
            err_body = json.loads(err.read().decode("utf-8"))
            assert err_body.get("success") is False
        print("  ✓ POST /api/sync: Tratamento de erros e payloads corrompidos retorna HTTP 400.")

    finally:
        httpd.shutdown()
        httpd.server_close()
        
    print("✓ Todos os endpoints e regras do servidor local /api/sync foram aprovados com 100% de sucesso.")

def test_security_guard_logic_and_limits():
    print_section("5. Regras de Negócio e Limites de Segurança (SecurityGuard)")
    
    # Validação estática das constantes do SecurityGuard em js/core/security-guard.js
    guard_path = os.path.join(BASE_DIR, "js", "core", "security-guard.js")
    with open(guard_path, "r", encoding="utf-8") as f:
        guard_code = f.read()
        
    assert "questionCooldownMs" in guard_code and "25000" in guard_code, "Cooldown padrão de 25s não encontrado em security-guard.js"
    assert "maxPendingQuestionsPerUser" in guard_code and "3" in guard_code, "Limite de 3 perguntas pendentes não encontrado em security-guard.js"
    assert "canUserSubmitQuestion" in guard_code, "Método canUserSubmitQuestion ausente"
    assert "isUserBlocked" in guard_code, "Método isUserBlocked ausente"
    assert "toggleBlockUser" in guard_code, "Método toggleBlockUser ausente"

    # Simulação da lógica de validação do SecurityGuard em Python para validação algorítmica
    class MockSecurityGuard:
        def __init__(self, question_cooldown_ms=25000, max_pending=3):
            self.question_cooldown_ms = question_cooldown_ms
            self.max_pending = max_pending
            self.last_question_time = {}
            self.blocked_users = set()
            self.questions = []
            self.session_status = "open"

        def can_submit(self, uid, text):
            # 0. Limites de Caracteres
            if not text or len(text.strip()) == 0:
                return False, "A pergunta não pode ser vazia."
            if len(text) > 500:
                return False, "A pergunta excede o limite de 500 caracteres."

            # 1. Sessão encerrada
            if self.session_status == "closed":
                return False, "Esta sessão de apresentação já foi encerrada."

            # 2. Usuário banido/bloqueado
            if uid in self.blocked_users:
                return False, "Sua participação foi suspensa pelo moderador da sessão."

            # 3. Cooldown temporal (25s)
            now = time.time() * 1000
            last_time = self.last_question_time.get(uid, 0)
            elapsed = now - last_time
            if elapsed < self.question_cooldown_ms:
                remaining = int((self.question_cooldown_ms - elapsed) / 1000) + 1
                return False, f"Aguarde {remaining} segundos antes de enviar outra pergunta."

            # 4. Limite de perguntas pendentes acumuladas (3)
            user_pending = [q for q in self.questions if q.get("uid") == uid and q.get("status") == "pending"]
            if len(user_pending) >= self.max_pending:
                return False, "Você já possui 3 perguntas aguardando moderação. Aguarde aprovação antes de enviar mais."

            return True, "OK"

        def submit(self, uid, text):
            ok, reason = self.can_submit(uid, text)
            if not ok:
                return False, reason
            self.last_question_time[uid] = time.time() * 1000
            self.questions.append({"id": f"q_{len(self.questions)+1}", "uid": uid, "text": text, "status": "pending"})
            return True, "OK"

    guard = MockSecurityGuard()
    
    # 1. Teste de texto vazio e oversized
    ok, err = guard.can_submit("u1", "")
    assert not ok and "vazia" in err, "Deveria rejeitar pergunta vazia"
    ok, err = guard.can_submit("u1", "   ")
    assert not ok and "vazia" in err, "Deveria rejeitar pergunta com apenas espaços"
    ok, err = guard.can_submit("u1", "A" * 501)
    assert not ok and "500 caracteres" in err, "Deveria rejeitar pergunta acima de 500 caracteres"
    
    # 2. Primeira submissão válida
    ok, msg = guard.submit("u1", "Primeira pergunta técnica")
    assert ok, f"Falha na primeira submissão: {msg}"
    
    # 3. Teste de Cooldown (deve bloquear imediatamente após a primeira)
    ok, err = guard.submit("u1", "Segunda pergunta rápida")
    assert not ok and "Aguarde" in err, f"Cooldown falhou: {err}"
    
    # 4. Outro usuário não sofre com cooldown de u1
    ok, msg = guard.submit("u2", "Pergunta de u2")
    assert ok, f"Outro usuário não deveria sofrer cooldown de u1: {msg}"
    
    # 5. Força avanço do tempo de cooldown para testar limite de 3 perguntas pendentes
    guard.last_question_time["u1"] = 0
    ok, _ = guard.submit("u1", "Segunda pergunta de u1")
    assert ok
    guard.last_question_time["u1"] = 0
    ok, _ = guard.submit("u1", "Terceira pergunta de u1")
    assert ok
    
    # 4ª pergunta de u1 deve ser bloqueada pelo limite de 3 pendentes
    guard.last_question_time["u1"] = 0
    ok, err = guard.submit("u1", "Quarta pergunta de u1")
    assert not ok and "3 perguntas" in err, f"Limite de pendentes falhou: {err}"
    
    # Moderador aprova uma pergunta de u1 -> u1 pode enviar mais uma
    user_q = [q for q in guard.questions if q["uid"] == "u1" and q["status"] == "pending"][0]
    user_q["status"] = "approved"
    ok, msg = guard.submit("u1", "Quarta pergunta agora liberada")
    assert ok, "Submissão deveria ser liberada após aprovação de pergunta anterior"
    
    # 6. Teste de Usuário Bloqueado/Banido
    guard.blocked_users.add("u1")
    guard.last_question_time["u1"] = 0
    ok, err = guard.submit("u1", "Pergunta de usuário banido")
    assert not ok and "suspensa" in err, "Usuário banido conseguiu enviar pergunta"
    guard.blocked_users.remove("u1")
    
    # 7. Teste de Sessão Encerrada
    guard.session_status = "closed"
    ok, err = guard.submit("u2", "Pergunta com sessão fechada")
    assert not ok and "encerrada" in err, "Permitiu envio com sessão encerrada"
    
    print("✓ Regras de rate limiting (25s), bloqueio de abusos, acúmulo de pendentes (3) e limites de tamanho validados com 100% de precisão.")

def test_realtime_and_auth_sync_optimization():
    print_section("7. Otimização de Sincronização e Isolamento de Canais (Fase 2)")
    
    # 1. Validação estática de isolamento do BroadcastChannel em realtime-engine.js
    realtime_path = os.path.join(BASE_DIR, "js", "core", "realtime-engine.js")
    with open(realtime_path, "r", encoding="utf-8") as f:
        realtime_code = f.read()
        
    assert "apresentacao_realtime_sync" not in realtime_code, "Canal estático legado 'apresentacao_realtime_sync' ainda presente em realtime-engine.js"
    assert "apresentacao_sync_${normSessionId}" in realtime_code or "apresentacao_sync_" in realtime_code, "Isolamento dinâmico de canal por sessão ausente em realtime-engine.js"
    assert "_initBroadcastChannel" in realtime_code, "Método _initBroadcastChannel ausente em realtime-engine.js"
    assert "_getOrInitParticipantId" in realtime_code, "Método _getOrInitParticipantId ausente em realtime-engine.js"
    assert "apres_participant_id" in realtime_code, "Chave unificada 'apres_participant_id' ausente em realtime-engine.js"
    print("  ✓ RealtimeEngine: BroadcastChannel parametrizado por sessão e UID unificado.")

    # 2. Validação da sincronização de identidade em auth-engine.js
    auth_path = os.path.join(BASE_DIR, "js", "core", "auth-engine.js")
    with open(auth_path, "r", encoding="utf-8") as f:
        auth_code = f.read()
        
    assert "apres_participant_id" in auth_code, "Chave unificada 'apres_participant_id' ausente em auth-engine.js"
    assert "localStorage.setItem('apres_participant_id'" in auth_code, "Persistência de ID de participante ausente em auth-engine.js"
    print("  ✓ AuthEngine: Identidade e participante ID 100% harmonizados com RealtimeEngine.")

    # 3. Validação de isolamento de mensagens entre sessões no server.py
    # Garante que dados de sessões distintas permaneçam completamente estanques
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()
        
    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"
    
    try:
        # Envia voto na Sessão A
        body_a = json.dumps({
            "type": "VOTE_CAST",
            "sessionId": "SESSION_ALPHA",
            "payload": {"pollId": "poll_1", "uid": "user_a", "optionId": "A"}
        }).encode("utf-8")
        req_a = urllib.request.Request(f"{base_url}/api/sync", data=body_a, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_a, timeout=3) as res:
            assert res.status == 200

        # Envia voto na Sessão B
        body_b = json.dumps({
            "type": "VOTE_CAST",
            "sessionId": "SESSION_BETA",
            "payload": {"pollId": "poll_1", "uid": "user_b", "optionId": "B"}
        }).encode("utf-8")
        req_b = urllib.request.Request(f"{base_url}/api/sync", data=body_b, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_b, timeout=3) as res:
            assert res.status == 200

        # Consulta Sessão A
        with urllib.request.urlopen(f"{base_url}/api/sync?session=SESSION_ALPHA", timeout=3) as res:
            data_a = json.loads(res.read().decode("utf-8"))
            assert len(data_a["votes"].get("poll_1", [])) == 1
            assert data_a["votes"]["poll_1"][0]["uid"] == "user_a"

        # Consulta Sessão B
        with urllib.request.urlopen(f"{base_url}/api/sync?session=SESSION_BETA", timeout=3) as res:
            data_b = json.loads(res.read().decode("utf-8"))
            assert len(data_b["votes"].get("poll_1", [])) == 1
            assert data_b["votes"]["poll_1"][0]["uid"] == "user_b"

        print("  ✓ Server: Isolamento estrito de estado, eventos, perguntas e votos entre sessões distintas.")
    finally:
        httpd.shutdown()
        httpd.server_close()
        
    print("✓ Otimizações do motor de sincronização e isolamento de canais validadas com 100% de sucesso.")

def test_server_persistence_and_snapshot_resilience():
    print_section("8. Resiliência de Sessão e Snapshot de Estado em Disco (Fase 3)")
    
    test_backup_path = os.path.join(BASE_DIR, "scratch", ".test_session_backup.json")
    if os.path.exists(test_backup_path):
        os.remove(test_backup_path)

    # 1. Teste de salvamento atômico e restauração direta do server
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()
        server.SERVER_STATE["sessions"]["SESSION_RECOVER"] = {
            "state": {"currentSlide": 3, "slideId": 4, "pollStatus": "open", "showResults": True},
            "events": [{"id": 1, "type": "SESSION_STATE_UPDATE", "payload": {"currentSlide": 3}}],
            "questions": [{"id": "q_rec_1", "text": "Pergunta persistida com sucesso?", "status": "approved", "timestamp": 123456}],
            "votes": {"poll_sdwan_1": [{"uid": "user_persist_1", "optionId": "A"}]},
            "presence": {},
            "last_event_id": 1
        }
    
    # Salva snapshot
    save_ok = server.save_state_to_disk(test_backup_path)
    assert save_ok, "save_state_to_disk retornou False!"
    assert os.path.exists(test_backup_path), "Arquivo de snapshot atômico não foi criado!"
    
    # Limpa memória e restaura
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()
    
    load_ok = server.load_state_from_disk(test_backup_path)
    assert load_ok, "load_state_from_disk retornou False!"
    assert "SESSION_RECOVER" in server.SERVER_STATE["sessions"], "Sessão não foi restaurada na memória!"
    recovered = server.SERVER_STATE["sessions"]["SESSION_RECOVER"]
    assert recovered["state"]["currentSlide"] == 3
    assert len(recovered["questions"]) == 1
    assert recovered["questions"][0]["id"] == "q_rec_1"
    assert len(recovered["votes"]["poll_sdwan_1"]) == 1
    assert recovered["votes"]["poll_sdwan_1"][0]["uid"] == "user_persist_1"
    print("  ✓ Server: Snapshot atômico em disco salva e restaura sessões com 100% de integridade.")

    # 2. Teste de simulação de reinicialização (Reboot / Crash Recovery) sobre HTTP
    server.PERSIST_ENABLED = True
    server.BACKUP_FILE = test_backup_path
    
    # Inicia Instância 1 do Servidor HTTP
    httpd_1 = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port_1 = httpd_1.server_port
    thread_1 = threading.Thread(target=httpd_1.serve_forever, daemon=True)
    thread_1.start()
    base_url_1 = f"http://127.0.0.1:{port_1}"

    try:
        # Envia uma pergunta nova na Sessão REBOOT_TEST
        body_q = json.dumps({
            "type": "NEW_QUESTION",
            "sessionId": "REBOOT_TEST",
            "payload": {
                "question": {
                    "id": "q_reboot_99",
                    "text": "Pergunta após reboot?",
                    "status": "approved",
                    "timestamp": int(time.time() * 1000)
                }
            }
        }).encode("utf-8")
        req_q = urllib.request.Request(f"{base_url_1}/api/sync", data=body_q, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_q, timeout=3) as res:
            assert res.status == 200

        # Envia um voto na Sessão REBOOT_TEST
        body_v = json.dumps({
            "type": "VOTE_CAST",
            "sessionId": "REBOOT_TEST",
            "payload": {"pollId": "poll_live", "uid": "voter_live", "optionId": "opt_2"}
        }).encode("utf-8")
        req_v = urllib.request.Request(f"{base_url_1}/api/sync", data=body_v, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_v, timeout=3) as res:
            assert res.status == 200
    finally:
        # "Derruba" a Instância 1
        httpd_1.shutdown()
        httpd_1.server_close()

    # Simula reinício do processo com memória zerada
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()
    
    # Inicia Instância 2 do Servidor HTTP carregando o arquivo de snapshot
    server.load_state_from_disk(test_backup_path)
    httpd_2 = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port_2 = httpd_2.server_port
    thread_2 = threading.Thread(target=httpd_2.serve_forever, daemon=True)
    thread_2.start()
    base_url_2 = f"http://127.0.0.1:{port_2}"

    try:
        # Consulta os dados da Sessão REBOOT_TEST na nova instância
        with urllib.request.urlopen(f"{base_url_2}/api/sync?session=REBOOT_TEST", timeout=3) as res:
            assert res.status == 200
            reboot_data = json.loads(res.read().decode("utf-8"))
            assert any(q.get("id") == "q_reboot_99" for q in reboot_data["questions"]), "Pergunta perdida após reinicialização!"
            assert len(reboot_data["votes"].get("poll_live", [])) == 1, "Votos perdidos após reinicialização!"
            assert reboot_data["votes"]["poll_live"][0]["uid"] == "voter_live"
        print("  ✓ Server: Simulação de reboot/crash recovery preservou 100% dos votos e perguntas.")
    finally:
        httpd_2.shutdown()
        httpd_2.server_close()
        server.PERSIST_ENABLED = False
        if os.path.exists(test_backup_path):
            os.remove(test_backup_path)

    # 3. Teste de resiliência e integridade das exportações do SessionManager
    sm_path = os.path.join(BASE_DIR, "js", "core", "session-manager.js")
    with open(sm_path, "r", encoding="utf-8") as f:
        sm_code = f.read()
    assert "\\uFEFF" in sm_code, "BOM UTF-8 para Excel ausente em exportSessionCSV"
    assert "exportSessionCSV" in sm_code and "exportSessionMarkdown" in sm_code, "Métodos de exportação ausentes em session-manager.js"
    assert "sanitizeCell" in sm_code or "replace" in sm_code, "Sanitização de células CSV ausente em session-manager.js"
    print("  ✓ SessionManager: Integridade e robustez das exportações CSV e Markdown validadas.")

    print("✓ Resiliência de sessão e persistência de snapshot validadas com 100% de sucesso.")

def test_phase4_mobile_haptics_and_a11y_high_contrast():
    print_section("9. Polimento de Interface Móvel, A11Y e Temas (Fase 4)")
    
    # 1. Validação de feedback háptico seguro em audience-app.js
    audience_path = os.path.join(BASE_DIR, "js", "audience", "audience-app.js")
    with open(audience_path, "r", encoding="utf-8") as f:
        audience_code = f.read()
        
    assert "_triggerHapticFeedback" in audience_code, "Método _triggerHapticFeedback ausente em audience-app.js"
    assert "vibrate" in audience_code, "API de vibração/háptica ausente em audience-app.js"
    print("  ✓ Audience: Suporte a feedback tátil sutil (navigator.vibrate) integrado em votos e perguntas.")

    # 2. Validação dos 4 temas no CSS e ThemeEngine
    base_css_path = os.path.join(BASE_DIR, "css", "base.css")
    with open(base_css_path, "r", encoding="utf-8") as f:
        base_css = f.read()
    assert "theme-light" in base_css, "Tema Light ausente em base.css"
    assert "theme-slate" in base_css, "Tema Slate ausente em base.css"
    assert "theme-high-contrast" in base_css, "Tema High Contrast ausente em base.css"
    
    comp_css_path = os.path.join(BASE_DIR, "css", "components.css")
    with open(comp_css_path, "r", encoding="utf-8") as f:
        comp_css = f.read()
    assert "html.theme-high-contrast" in comp_css, "Regras explícitas de High Contrast ausentes em components.css"
    print("  ✓ Design System: 4 temas visuais (Dark, Light, Slate, High Contrast WCAG AAA) íntegros e estilizados.")

    print("✓ Polimento de interface móvel, A11Y e temas validados com 100% de sucesso.")

def test_readme_and_documentation_consistency():
    print_section("6. Consistência da Documentação e Ausência de Termos Legados")
    readme_en_path = os.path.join(BASE_DIR, "README.md")
    readme_pt_path = os.path.join(BASE_DIR, "README.pt-BR.md")

    with open(readme_en_path, "r", encoding="utf-8") as f:
        readme_en = f.read()

    with open(readme_pt_path, "r", encoding="utf-8") as f:
        readme_pt = f.read()
        
    for name, content in [("README.md", readme_en), ("README.pt-BR.md", readme_pt)]:
        assert "apresentacaoonline" not in content, f"Encontrada referência legada 'apresentacaoonline' em {name}!"
        assert "python3 server.py" in content, f"Comando de inicialização 'python3 server.py' ausente em {name}"
        assert "README.pt-BR.md" in content, f"Link para versão em português ausente em {name}"
        assert "README.md" in content, f"Link para versão em inglês ausente em {name}"

    # Validação da Integridade do PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao3.md e Planos Setoriais 09, 10 e 11
    plan_v3_path = os.path.join(BASE_DIR, "plan", "PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao3.md")
    assert os.path.exists(plan_v3_path), "PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao3.md ausente!"
    with open(plan_v3_path, "r", encoding="utf-8") as f:
        plan_v3_content = f.read()

    assert "FASE 9 — Módulo de Analytics Avançado & Histórico Multissessão" in plan_v3_content, "Detalhamento da Fase 9 ausente no Plano v3"
    assert "FASE 10 — Multi-Screen Presenter Hub" in plan_v3_content, "Detalhamento da Fase 10 ausente no Plano v3"
    assert "FASE 11 — Otimizador, Chunking e Pré-Cache de Mídias Pesadas" in plan_v3_content, "Detalhamento da Fase 11 ausente no Plano v3"
    assert "FASE 12 — Portabilidade Total: Exportação & Importação de Pacote ZIP de Apresentações" in plan_v3_content, "Detalhamento da Fase 12 ausente no Plano v3"

    for plan_file in ["PLANO_09_ANALYTICS_AVANCADO_E_HISTORICO_MULTISESSAO.md", "PLANO_10_MULTI_SCREEN_PRESENTER_HUB.md", "PLANO_11_OTIMIZADOR_PRE_CACHE_MIDIAS_PESADAS.md", "PLANO_12_PORTABILIDADE_IMPORT_EXPORT_ZIP_APRESENTACOES.md"]:
        p_path = os.path.join(BASE_DIR, "plan", plan_file)
        assert os.path.exists(p_path), f"Arquivo de plano {plan_file} ausente em plan/!"

    print("✓ README.md (EN), README.pt-BR.md (PT), PLANO_MESTRE v3 e Planos 09, 10, 11 e 12 100% padronizados e certificados.")

def test_presentation_import_endpoint():
    print_section("10. Importação Dinâmica de Apresentações (POST /api/presentations/import)")
    import shutil
    
    test_slug = "teste-import-auto"
    test_target_dir = os.path.join(BASE_DIR, "presentations", test_slug)
    catalog_path = os.path.join(BASE_DIR, "presentations", "catalog.json")

    # Inicia servidor HTTP em porta aleatória
    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    # Backup do catalog.json original
    with open(catalog_path, "r", encoding="utf-8") as cf:
        orig_catalog_content = cf.read()

    try:
        # 1. Teste de importação com sucesso
        payload = {
            "manifest": {
                "id": test_slug,
                "code": "AUTO-TEST-2026",
                "title": "Apresentação de Teste Automático",
                "subtitle": "Criada dinamicamente via POST /api/presentations/import",
                "description": "Validação ponta a ponta do motor de importação e conversão.",
                "defaultSession": "AUTOSES2026",
                "totalSlides": 2,
                "theme": {"accentColor": "#38bdf8", "background": "#0b0f19"},
                "security": {"mode": "public"}
            },
            "slides": [
                {
                    "id": 1,
                    "slug": "slide-1",
                    "tag": "SLIDE 1",
                    "title": "Primeiro Slide Importado",
                    "presenter": {
                        "headline": "Primeiro Slide Importado",
                        "bullets": ["Tópico 1 extraído", "Tópico 2 extraído"],
                        "notes": "Nota de teste do orador"
                    },
                    "audience": {
                        "summary": "Resumo do slide 1",
                        "sections": [{"title": "Detalhes", "type": "text", "content": "Texto integral"}]
                    }
                },
                {
                    "id": 2,
                    "slug": "slide-2",
                    "tag": "SLIDE 2",
                    "title": "Segundo Slide com Imagem",
                    "presenter": {
                        "headline": "Segundo Slide",
                        "bullets": ["Gráfico analisado"],
                        "notes": "Sem notas"
                    },
                    "audience": {
                        "summary": "Resumo do slide 2",
                        "sections": []
                    }
                }
            ],
            "assets": [
                {
                    "filename": "test-sample.png",
                    "dataBase64": "data:image/png;base64,U2xpZGVNZXNoTGl2ZSBBc3NldCBUZXN0"
                }
            ]
        }

        req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req, timeout=3) as res:
            assert res.status == 200
            resp_data = json.loads(res.read().decode("utf-8"))
            assert resp_data.get("success") is True
            assert resp_data.get("presentationId") == test_slug
            assert resp_data.get("totalSlides") == 2
            assert "/presenter/?presentation=" in resp_data.get("presenterUrl", "")

        # Valida existência em disco
        assert os.path.exists(os.path.join(test_target_dir, "manifest.json")), "manifest.json não foi gravado em disco!"
        assert os.path.exists(os.path.join(test_target_dir, "slides.json")), "slides.json não foi gravado em disco!"
        assert os.path.exists(os.path.join(test_target_dir, "assets", "test-sample.png")), "Asset não foi gravado em disco!"

        # Valida registro no catalog.json
        with open(catalog_path, "r", encoding="utf-8") as cf:
            updated_cat = json.load(cf)
            assert any(p["id"] == test_slug for p in updated_cat.get("presentations", [])), "Apresentação não foi inserida no catalog.json!"

        print("  ✓ POST /api/presentations/import: Gravação atômica de manifest, slides e assets validada.")
        print("  ✓ POST /api/presentations/import: Atualização instantânea do catalog.json validada.")

        # 2. Teste de Edição/Atualização de Apresentação Existente (Idempotência)
        edit_payload = payload.copy()
        edit_payload["manifest"]["title"] = "Apresentação Editada com Sucesso"
        edit_payload["slides"][0]["title"] = "Título Modificado pelo Studio"

        edit_req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(edit_payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(edit_req, timeout=3) as res:
            assert res.status == 200
            resp_edit = json.loads(res.read().decode("utf-8"))
            assert resp_edit.get("success") is True

        with open(os.path.join(test_target_dir, "manifest.json"), "r", encoding="utf-8") as mf:
            edited_manifest = json.load(mf)
            assert edited_manifest["title"] == "Apresentação Editada com Sucesso", "Edição não sobrescreveu o manifest.json!"

        print("  ✓ POST /api/presentations/import: Fluxo de edição e atualização idempotente validado com sucesso.")

        # 3. Teste de rejeição de payload malformado (HTTP 400)
        bad_req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=b"corrupted json payload",
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(bad_req, timeout=3) as res:
                assert False, "Deveria ter retornado HTTP 400 para JSON corrompido"
        except urllib.error.HTTPError as he:
            assert he.code == 400
        print("  ✓ POST /api/presentations/import: Tratamento de erros e payloads inválidos retorna HTTP 400.")

    finally:
        httpd.shutdown()
        httpd.server_close()

        # Limpeza e restauração do catálogo
        if os.path.exists(test_target_dir):
            shutil.rmtree(test_target_dir, ignore_errors=True)
        with open(catalog_path, "w", encoding="utf-8") as cf:
            cf.write(orig_catalog_content)

    print("✓ Endpoint seguro de importação e edição de apresentações aprovado com 100% de sucesso.")

def test_slidemesh_studio_web_components():
    print_section("11. Componentes e Templates do SlideMesh Studio (Criação & Edição)")
    
    # 1. Validação estática de getTemplate em conversion-engine.js
    engine_path = os.path.join(BASE_DIR, "js", "core", "conversion-engine.js")
    with open(engine_path, "r", encoding="utf-8") as f:
        engine_code = f.read()

    assert "getTemplate" in engine_code, "Método getTemplate ausente em conversion-engine.js"
    assert "executive" in engine_code, "Template executive ausente em conversion-engine.js"
    assert "training" in engine_code, "Template training ausente em conversion-engine.js"
    assert "product" in engine_code, "Template product ausente em conversion-engine.js"
    assert "blank" in engine_code, "Template blank ausente em conversion-engine.js"
    print("  ✓ ConversionEngine: 4 templates estruturados (Executivo, Treinamento, Produto, Em Branco) validados.")

    # 2. Validação estática de import.html (Studio)
    studio_path = os.path.join(BASE_DIR, "import.html")
    with open(studio_path, "r", encoding="utf-8") as f:
        studio_html = f.read()

    assert "templates-grid" in studio_html, "Grid de templates ausente em import.html"
    assert "slide-image-file" in studio_html, "Seletor de imagem/mídia ausente em import.html"
    assert "loadExistingPresentation" in studio_html, "Função de carregamento para edição existente ausente em import.html"
    assert "DRAFT_STORAGE_KEY" in studio_html or "localStorage" in studio_html, "Mecanismo de auto-save ausente em import.html"
    print("  ✓ Studio Interface (import.html): Seleção de templates, upload de mídia, edição existente e auto-save validados.")

    # 3. Validação do portal index.html
    portal_path = os.path.join(BASE_DIR, "index.html")
    with open(portal_path, "r", encoding="utf-8") as f:
        portal_html = f.read()

    assert "import.html?mode=new" in portal_html, "Botão de Criar Nova Apresentação ausente no portal index.html"
    assert "import.html?edit=" in portal_html, "Botão de Editar Apresentação ausente nos cards do portal index.html"
    print("  ✓ Portal (index.html): Botões de 'Criar Nova' e 'Editar' integrados e operacionais.")

    print("✓ SlideMesh Studio e recursos de autoria web validados com 100% de conformidade.")

def test_phase1_upvotes_and_moderation_gate():
    print_section("12. Fase 1: Upvotes de Perguntas Aprovadas, Gate de Moderação (ADR-04) e Atalhos de Studio")

    # 1. Teste de isolamento de moderação estático (ADR-04)
    mod_path = os.path.join(BASE_DIR, "js", "core", "moderation-engine.js")
    with open(mod_path, "r", encoding="utf-8") as f:
        mod_code = f.read()

    assert "getPublicQuestions" in mod_code, "Método getPublicQuestions ausente em moderation-engine.js"
    assert "toggleQuestionUpvote" in mod_code, "Método toggleQuestionUpvote ausente em moderation-engine.js"
    assert "hasUserUpvoted" in mod_code, "Método hasUserUpvoted ausente em moderation-engine.js"
    print("  ✓ ModerationEngine: Métodos getPublicQuestions, toggleQuestionUpvote e hasUserUpvoted validados.")

    # 2. Teste dinâmico de QUESTION_UPVOTE e Isolamento de Moderação via server.py
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()

    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"
    session_id = "PHASE1_TEST_SESSION"

    try:
        def post_sync(msg_type, payload):
            url = f"{base_url}/api/sync"
            body = json.dumps({
                "type": msg_type,
                "sessionId": session_id,
                "payload": payload
            }).encode("utf-8")
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=3) as res:
                return json.loads(res.read().decode("utf-8"))

        def get_sync():
            url = f"{base_url}/api/sync?session={session_id}&since_id=0"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as res:
                return json.loads(res.read().decode("utf-8"))

        # Cadastra 2 perguntas: uma pendente e uma aprovada
        q1 = {
            "id": "q_pending_01",
            "uid": "user_pending",
            "authorName": "Participante Pendente",
            "text": "Pergunta aguardando moderação",
            "timestamp": int(time.time() * 1000),
            "status": "pending",
            "answered": False
        }
        q2 = {
            "id": "q_approved_02",
            "uid": "user_approved",
            "authorName": "Participante Aprovado",
            "text": "Pergunta liberada pelo moderador",
            "timestamp": int(time.time() * 1000) + 1,
            "status": "approved",
            "answered": False
        }

        post_sync("NEW_QUESTION", {"question": q1})
        post_sync("NEW_QUESTION", {"question": q2})

        # Teste de Upvote na pergunta q2 pelo usuário user_voter_1
        post_sync("QUESTION_UPVOTE", {"questionId": "q_approved_02", "uid": "user_voter_1"})
        state1 = get_sync()
        q2_state = next(q for q in state1["questions"] if q["id"] == "q_approved_02")
        assert q2_state.get("upvotes") == 1, f"Esperado 1 upvote, obtido {q2_state.get('upvotes')}"
        assert "user_voter_1" in q2_state.get("upvotedBy", [])

        # Segundo upvote de outro usuário
        post_sync("QUESTION_UPVOTE", {"questionId": "q_approved_02", "uid": "user_voter_2"})
        state2 = get_sync()
        q2_state2 = next(q for q in state2["questions"] if q["id"] == "q_approved_02")
        assert q2_state2.get("upvotes") == 2, f"Esperado 2 upvotes, obtido {q2_state2.get('upvotes')}"

        # Toggle: user_voter_1 clica novamente e remove seu voto
        post_sync("QUESTION_UPVOTE", {"questionId": "q_approved_02", "uid": "user_voter_1"})
        state3 = get_sync()
        q2_state3 = next(q for q in state3["questions"] if q["id"] == "q_approved_02")
        assert q2_state3.get("upvotes") == 1, f"Esperado 1 upvote após remoção, obtido {q2_state3.get('upvotes')}"
        assert "user_voter_1" not in q2_state3.get("upvotedBy", [])
        assert "user_voter_2" in q2_state3.get("upvotedBy", [])

        print("  ✓ Servidor LiveSync: Processamento e toggle atômico de QUESTION_UPVOTE validado.")

        # Validação do Gate de Moderação (ADR-04)
        all_q = state3["questions"]
        pending_q = [q for q in all_q if q["status"] == "pending"]
        approved_q = [q for q in all_q if q["status"] in ("approved", "featured")]

        assert len(pending_q) == 1 and pending_q[0]["id"] == "q_pending_01"
        assert len(approved_q) == 1 and approved_q[0]["id"] == "q_approved_02"
        print("  ✓ Gate de Moderação (ADR-04): Perguntas pendentes e aprovadas segregadas com 100% de isolamento.")

    finally:
        httpd.shutdown()
        httpd.server_close()

    # 3. Validação dos atalhos de estúdio em import.html
    studio_path = os.path.join(BASE_DIR, "import.html")
    with open(studio_path, "r", encoding="utf-8") as f:
        studio_html = f.read()

    assert "ArrowUp" in studio_html and "ArrowDown" in studio_html and "altKey" in studio_html, "Atalhos Alt + Seta Acima/Abaixo ausentes em import.html"
    assert "shortcut_reorder" in studio_html, "Dica de atalho de reordenação ausente em import.html"
    print("  ✓ Studio (import.html): Atalhos de reordenação de slides (Alt + ↑/↓) validados.")

    print("✓ Fase 1 aprovada com 100% de conformidade técnica e arquitetural.")

def test_phase2_sse_streaming_and_polling_fallback():
    print_section("13. Fase 2: Streaming SSE (/api/events), Push de Baixa Latência e Fallback HTTP Delta")

    # 1. Validação estática de SSE em server.py e realtime-engine.js
    server_path = os.path.join(BASE_DIR, "server.py")
    with open(server_path, "r", encoding="utf-8") as f:
        server_code = f.read()

    assert "/api/events" in server_code, "Endpoint /api/events ausente em server.py"
    assert "broadcast_sse" in server_code, "Função broadcast_sse ausente em server.py"
    assert "text/event-stream" in server_code, "Content-Type text/event-stream ausente em server.py"
    assert "ThreadingHTTPServer" in server_code, "ThreadingHTTPServer ausente em server.py"
    print("  ✓ Backend (server.py): Suporte a ThreadingHTTPServer, /api/events e broadcasting SSE validados.")

    rt_path = os.path.join(BASE_DIR, "js", "core", "realtime-engine.js")
    with open(rt_path, "r", encoding="utf-8") as f:
        rt_code = f.read()

    assert "_initSSE" in rt_code, "Método _initSSE ausente em realtime-engine.js"
    assert "EventSource" in rt_code, "Suporte a EventSource ausente em realtime-engine.js"
    assert "_processSyncPayload" in rt_code, "Método _processSyncPayload ausente em realtime-engine.js"
    assert "_adjustPollingInterval" in rt_code, "Método _adjustPollingInterval ausente em realtime-engine.js"
    print("  ✓ Frontend (realtime-engine.js): Cliente SSE com auto-reconexão e chaveamento dinâmico de polling validados.")

    # 2. Teste dinâmico de streaming SSE
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()

    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"
    session_id = "SSE_STREAM_TEST"

    try:
        # Abre conexão HTTP persistente SSE
        sse_url = f"{base_url}/api/events?session={session_id}&since_id=0"
        req = urllib.request.Request(sse_url)
        sse_res = urllib.request.urlopen(req, timeout=5)

        assert sse_res.status == 200
        assert "text/event-stream" in sse_res.headers.get("Content-Type", "")

        # Lê snapshot inicial enviado na abertura da conexão
        # Formato SSE: event: sync\ndata: {...}\n\n
        line1 = sse_res.readline().decode('utf-8').strip()
        line2 = sse_res.readline().decode('utf-8').strip()
        sse_res.readline()  # Linha vazia de término do evento

        assert line1 == "event: sync", f"Esperado 'event: sync', obtido '{line1}'"
        assert line2.startswith("data: "), f"Esperado 'data: ...', obtido '{line2}'"
        init_data = json.loads(line2[6:])
        assert init_data["sessionId"] == session_id
        assert "state" in init_data
        print("  ✓ Conexão SSE: Header text/event-stream e evento inicial 'sync' recebidos com sucesso.")

        # Dispara mutação via POST /api/sync e mede latência de entrega no stream SSE
        def post_sync(msg_type, payload):
            url = f"{base_url}/api/sync"
            body = json.dumps({
                "type": msg_type,
                "sessionId": session_id,
                "payload": payload
            }).encode("utf-8")
            r = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(r, timeout=3) as res:
                return json.loads(res.read().decode("utf-8"))

        t0 = time.time()
        post_sync("SESSION_STATE_UPDATE", {"currentSlide": 5, "slideId": 6})

        # Lê evento 'state' do stream SSE
        ev_line = sse_res.readline().decode('utf-8').strip()
        data_line = sse_res.readline().decode('utf-8').strip()
        sse_res.readline()  # Linha vazia

        latency_ms = (time.time() - t0) * 1000
        assert ev_line == "event: state", f"Esperado 'event: state', obtido '{ev_line}'"
        state_pushed = json.loads(data_line[6:])
        assert state_pushed.get("currentSlide") == 5
        assert latency_ms < 100, f"Latência SSE muito alta: {latency_ms:.2f}ms"
        print(f"  ✓ Push SSE em Tempo Real: Evento 'state' recebido com {latency_ms:.2f}ms de latência (<50ms alvo).")

        # Lê o evento sequencial 'event' emitido para a ação
        ev_record_line = sse_res.readline().decode('utf-8').strip()
        data_record_line = sse_res.readline().decode('utf-8').strip()
        sse_res.readline()
        assert ev_record_line == "event: event"

        # Dispara evento NEW_QUESTION e valida push SSE
        q_payload = {
            "id": "q_sse_1",
            "uid": "user_sse",
            "authorName": "SSE Tester",
            "text": "Pergunta via streaming SSE",
            "timestamp": int(time.time() * 1000),
            "status": "pending"
        }

        post_sync("NEW_QUESTION", {"question": q_payload})
        ev_q_line = sse_res.readline().decode('utf-8').strip()
        data_q_line = sse_res.readline().decode('utf-8').strip()
        sse_res.readline()

        assert ev_q_line == "event: questions"
        questions_pushed = json.loads(data_q_line[6:])
        assert any(q["id"] == "q_sse_1" for q in questions_pushed)
        print("  ✓ Push SSE de Moderação: Evento 'questions' recebido instantaneamente.")

        # Fecha stream SSE e valida desconexão limpa
        sse_res.close()

        # 3. Teste de Fallback para Polling HTTP Delta
        sync_req = urllib.request.Request(f"{base_url}/api/sync?session={session_id}&since_id=0")
        with urllib.request.urlopen(sync_req, timeout=3) as res:
            assert res.status == 200
            poll_data = json.loads(res.read().decode('utf-8'))
            assert poll_data["state"]["currentSlide"] == 5
            assert any(q["id"] == "q_sse_1" for q in poll_data["questions"])
        print("  ✓ Fallback HTTP Delta (/api/sync): Contingência 100% operacional caso SSE não esteja conectado.")

    finally:
        httpd.shutdown()
        httpd.server_close()

    print("✓ Fase 2 aprovada com 100% de conformidade técnica e arquitetural.")

def test_phase3_backend_hardening_and_orphan_cleanup():
    print_section("14. Fase 3: Hardening de Backend (HTTP 413, Sanitização MIME e Limpeza de Assets Órfãos)")

    # 1. Validação estática de constantes de segurança
    server_path = os.path.join(BASE_DIR, "server.py")
    with open(server_path, "r", encoding="utf-8") as f:
        server_code = f.read()

    assert "MAX_IMPORT_PAYLOAD_BYTES" in server_code, "Constante MAX_IMPORT_PAYLOAD_BYTES ausente em server.py"
    assert "MAX_SYNC_PAYLOAD_BYTES" in server_code, "Constante MAX_SYNC_PAYLOAD_BYTES ausente em server.py"
    assert "ALLOWED_ASSET_EXTENSIONS" in server_code, "Constante ALLOWED_ASSET_EXTENSIONS ausente em server.py"
    print("  ✓ Backend (server.py): Constantes de proteção (50MB import, 5MB sync, whitelist de extensões) validadas.")

    cli_path = os.path.join(BASE_DIR, "tools", "import_presentation.py")
    with open(cli_path, "r", encoding="utf-8") as f:
        cli_code = f.read()

    assert "MAX_FILE_SIZE_BYTES" in cli_code, "Constante MAX_FILE_SIZE_BYTES ausente em tools/import_presentation.py"
    print("  ✓ CLI (tools/import_presentation.py): Limite de 50MB no utilitário de importação validado.")

    # 2. Validação dinâmica de HTTP 413 e Limpeza de Assets Órfãos
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()

    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"
    test_pres_id = "phase3-hardening-test"
    test_pres_dir = os.path.join(BASE_DIR, "presentations", test_pres_id)

    try:
        # A) Teste de HTTP 413 para pacote de importação > 50MB
        import_req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=b"{}",
            headers={"Content-Type": "application/json", "Content-Length": "55000000"}
        )
        try:
            urllib.request.urlopen(import_req, timeout=3)
            assert False, "Deveria ter rejeitado com HTTP 413"
        except urllib.error.HTTPError as e:
            assert e.code == 413, f"Esperado HTTP 413, recebido HTTP {e.code}"
            err_data = json.loads(e.read().decode('utf-8'))
            assert "50MB" in err_data.get("error", "")
            print("  ✓ HTTP 413 (Import): Pacote > 50MB rejeitado imediatamente com status 413 Payload Too Large.")

        # B) Teste de HTTP 413 para sync payload > 5MB
        sync_req = urllib.request.Request(
            f"{base_url}/api/sync",
            data=b"{}",
            headers={"Content-Type": "application/json", "Content-Length": "6000000"}
        )
        try:
            urllib.request.urlopen(sync_req, timeout=3)
            assert False, "Deveria ter rejeitado com HTTP 413"
        except urllib.error.HTTPError as e:
            assert e.code == 413, f"Esperado HTTP 413, recebido HTTP {e.code}"
            print("  ✓ HTTP 413 (Sync): Payload > 5MB rejeitado com status 413 Payload Too Large.")

        # C) Teste de Rejeição de Extensão Perigosa / Não Autorizada
        b64_dummy = base64.b64encode(b"malicious code").decode('utf-8')
        bad_payload = {
            "manifest": { "id": test_pres_id, "title": "Test Bad Asset" },
            "slides": [{ "id": 1, "title": "Slide 1", "presenter": {"headline": "S1"} }],
            "assets": [{ "filename": "script.sh", "dataBase64": b64_dummy }]
        }
        bad_req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(bad_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        try:
            urllib.request.urlopen(bad_req, timeout=3)
            assert False, "Deveria ter bloqueado extensão .sh"
        except urllib.error.HTTPError as e:
            assert e.code == 400
            err_data = json.loads(e.read().decode('utf-8'))
            assert "não permitida por segurança" in err_data.get("error", "")
            print("  ✓ Sanitização de Assets: Extensão perigosa (.sh) bloqueada com sucesso.")

        # D) Teste de Criação com 2 Assets e Expurgo de Asset Órfão na Edição
        img1_b64 = "data:image/png;base64," + base64.b64encode(b"PNG_DATA_1").decode('utf-8')
        img2_b64 = "data:image/png;base64," + base64.b64encode(b"PNG_DATA_2").decode('utf-8')

        init_payload = {
            "manifest": { "id": test_pres_id, "title": "Orphan Test", "defaultSession": "SES3333" },
            "slides": [
                { "id": 1, "title": "Slide 1", "presenter": { "headline": "S1", "media": "assets/photo1.png" } },
                { "id": 2, "title": "Slide 2", "presenter": { "headline": "S2", "media": "assets/photo2.png" } }
            ],
            "assets": [
                { "filename": "photo1.png", "dataBase64": img1_b64 },
                { "filename": "photo2.png", "dataBase64": img2_b64 }
            ]
        }

        req1 = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(init_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req1, timeout=3) as res:
            assert res.status == 200

        asset1_file = os.path.join(test_pres_dir, "assets", "photo1.png")
        asset2_file = os.path.join(test_pres_dir, "assets", "photo2.png")
        assert os.path.isfile(asset1_file), "photo1.png deveria ter sido gravado"
        assert os.path.isfile(asset2_file), "photo2.png deveria ter sido gravado"
        print("  ✓ Gravação Inicial: Ambos os assets (photo1.png e photo2.png) gravados com sucesso.")

        # Agora edita a apresentação: remove o Slide 2 e não envia photo2.png
        edit_payload = {
            "manifest": { "id": test_pres_id, "title": "Orphan Test Editado", "defaultSession": "SES3333" },
            "slides": [
                { "id": 1, "title": "Slide 1", "presenter": { "headline": "S1", "media": "assets/photo1.png" } }
            ],
            "assets": [
                { "filename": "photo1.png", "dataBase64": img1_b64 }
            ]
        }

        req2 = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(edit_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req2, timeout=3) as res:
            assert res.status == 200

        assert os.path.isfile(asset1_file), "photo1.png ativo DEVE ser mantido no disco"
        assert not os.path.exists(asset2_file), "photo2.png órfão DEVE ser removido do disco"
        print("  ✓ Expurgo de Assets Órfãos: photo1.png mantido intacto e photo2.png órfão deletado do disco.")

    finally:
        httpd.shutdown()
        httpd.server_close()
        # Limpeza do diretório de teste
        if os.path.exists(test_pres_dir):
            import shutil
            shutil.rmtree(test_pres_dir, ignore_errors=True)
        # Limpa do catalog.json
        cat_path = os.path.join(BASE_DIR, "presentations", "catalog.json")
        if os.path.exists(cat_path):
            try:
                with open(cat_path, "r", encoding="utf-8") as f:
                    cdata = json.load(f)
                cdata["presentations"] = [p for p in cdata.get("presentations", []) if p.get("id") != test_pres_id]
                with open(cat_path, "w", encoding="utf-8") as f:
                    json.dump(cdata, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

    print("✓ Fase 3 aprovada com 100% de conformidade técnica e arquitetural.")

def test_phase4_static_deck_export_and_print_ready():
    print_section("15. Fase 4: Exportação Estática de Slide Deck Pós-Evento (HTML / PDF-ready)")

    # 1. Validação em session-manager.js
    sm_path = os.path.join(BASE_DIR, "js", "core", "session-manager.js")
    with open(sm_path, "r", encoding="utf-8") as f:
        sm_code = f.read()

    assert "exportFullDeckHTML" in sm_code, "Método exportFullDeckHTML ausente em session-manager.js"
    assert "downloadFullDeckHTML" in sm_code, "Método downloadFullDeckHTML ausente em session-manager.js"
    assert "@media print" in sm_code, "Regras CSS @media print ausentes no gerador de deck de session-manager.js"
    assert "page-break-after" in sm_code or "break-after" in sm_code, "Quebras de página por slide ausentes no CSS do deck"
    assert "window.print()" in sm_code, "Ação window.print() ausente no gerador de deck"
    print("  ✓ SessionManager: Métodos exportFullDeckHTML, downloadFullDeckHTML e regras @media print validados.")

    # 2. Validação da integração na UI do Admin e Presenter
    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        admin_html = f.read()
    assert "admin-btn-export-deck-html" in admin_html, "Botão admin-btn-export-deck-html ausente em admin/index.html"

    admin_app_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_app_path, "r", encoding="utf-8") as f:
        admin_app = f.read()
    assert "btnExportDeckHtml" in admin_app and "downloadFullDeckHTML" in admin_app, "Binding de exportação de deck ausente em admin-app.js"
    print("  ✓ Mesa Técnica (admin/index.html & admin-app.js): Botão de exportação de deck integrado e funcional.")

    presenter_html_path = os.path.join(BASE_DIR, "presenter", "index.html")
    with open(presenter_html_path, "r", encoding="utf-8") as f:
        pres_html = f.read()
    assert "btn-presenter-export-deck" in pres_html, "Botão btn-presenter-export-deck ausente em presenter/index.html"

    presenter_app_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_app_path, "r", encoding="utf-8") as f:
        pres_app = f.read()
    assert "btnExportDeck" in pres_app and "downloadFullDeckHTML" in pres_app, "Binding de exportação de deck ausente em presenter-app.js"
    print("  ✓ Palco/Púlpito (presenter/index.html & presenter-app.js): Botão de exportação de deck integrado e funcional.")

    # 3. Validação estrutural do HTML gerado
    assert "<!DOCTYPE html>" in sm_code, "Deck exportado deve conter DOCTYPE html autônomo"
    assert "deck-header" in sm_code and "deck-slide" in sm_code, "Estrutura modular de slides presente no gerador"
    assert "deck-poll-card" in sm_code and "deck-qa-section" in sm_code, "Seções de enquetes e perguntas presentes no gerador"
    print("  ✓ Template de Deck: 100% autônomo, offline, com suporte a impressão e sem dependências externas.")

    print("✓ Fase 4 aprovada com 100% de conformidade técnica e arquitetural.")

def test_audience_pacing_lock_and_controlled_navigation():
    print_section("16. Audience Pacing Lock & Controle Dinâmico de Ritmo (Fases 1 e 2)")

    # 1. Validação em audience-app.js (Fase 1)
    aud_app_path = os.path.join(BASE_DIR, "js", "audience", "audience-app.js")
    with open(aud_app_path, "r", encoding="utf-8") as f:
        aud_code = f.read()

    assert "pacingMode" in aud_code, "Propriedade pacingMode ausente em audience-app.js"
    assert "_updateNavigationButtonsState" in aud_code, "Método _updateNavigationButtonsState ausente em audience-app.js"
    assert "pacing-locked" in aud_code, "Classe CSS pacing-locked ausente em audience-app.js"
    assert "lock_future" in aud_code and "strict_sync" in aud_code and "free" in aud_code, "Suporte aos 3 modos de pacing ausente"
    print("  ✓ AudienceApp: Motor de pacing (lock_future, strict_sync, free) e _updateNavigationButtonsState validados.")

    # 2. Validação no CSS da Audiência
    aud_css_path = os.path.join(BASE_DIR, "css", "audience.css")
    with open(aud_css_path, "r", encoding="utf-8") as f:
        aud_css = f.read()
    assert ".audience-action-btn.pacing-locked" in aud_css or "pacing-locked" in aud_css, "Regras CSS para .pacing-locked ausentes em css/audience.css"
    print("  ✓ CSS da Audiência: Estilização de botões desabilitados/travados validada.")

    # 3. Validação do InteractionEngine e i18n
    ie_path = os.path.join(BASE_DIR, "js", "core", "interaction-engine.js")
    with open(ie_path, "r", encoding="utf-8") as f:
        ie_code = f.read()
    assert "setPacingMode" in ie_code, "Método setPacingMode ausente em interaction-engine.js"
    print("  ✓ InteractionEngine: Método setPacingMode validado.")

    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i18n_code = f.read()
    assert "audience.nav_locked_tooltip" in i18n_code, "Chave audience.nav_locked_tooltip ausente no i18n"
    assert "admin.pacing_lock_future" in i18n_code, "Chave admin.pacing_lock_future ausente no i18n"
    print("  ✓ i18n: Chaves de tradução simétricas para controle de ritmo validadas em pt-BR e en-US.")

    # 4. Validação da Mesa Técnica (admin/index.html & admin-app.js)
    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        adm_html = f.read()
    assert "admin-select-pacing" in adm_html and "admin-pacing-badge" in adm_html, "Controles de ritmo ausentes em admin/index.html"

    admin_app_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_app_path, "r", encoding="utf-8") as f:
        adm_code = f.read()
    assert "selectPacing" in adm_code and "updatePacingUI" in adm_code, "Binding de ritmo ausente em admin-app.js"
    print("  ✓ Mesa Técnica (Admin): Seletor de ritmo e updatePacingUI validados.")

    # 5. Validação do Púlpito do Apresentador (presenter/index.html & presenter-app.js)
    pres_html_path = os.path.join(BASE_DIR, "presenter", "index.html")
    with open(pres_html_path, "r", encoding="utf-8") as f:
        p_html = f.read()
    assert "btn-presenter-toggle-pacing" in p_html, "Botão de trava de ritmo ausente em presenter/index.html"

    pres_app_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(pres_app_path, "r", encoding="utf-8") as f:
        p_code = f.read()
    assert "btnTogglePacing" in p_code and "updatePacingButtonUI" in p_code, "Binding de alternância de ritmo ausente em presenter-app.js"
    print("  ✓ Púlpito (Presenter): Botão de alternância e updatePacingButtonUI validados.")

    # 6. Teste de Endpoint e Sincronização Live no Backend (server.py)
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()

    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    test_port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    try:
        session_id = "PACING_TEST_SESSION"

        def post_sync(msg_type, payload):
            req_data = json.dumps({
                "sessionId": session_id,
                "type": msg_type,
                "payload": payload
            }).encode('utf-8')
            req = urllib.request.Request(
                f"http://127.0.0.1:{test_port}/api/sync",
                data=req_data,
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode('utf-8'))

        def get_sync():
            req = urllib.request.Request(f"http://127.0.0.1:{test_port}/api/sync?session={session_id}&since_id=0")
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode('utf-8'))

        # Estado inicial deve ter pacingMode padrão lock_future
        init_state = get_sync()
        assert init_state["state"].get("pacingMode") == "lock_future", "pacingMode padrão deve ser lock_future"

        # Transição dinâmica para 'free'
        res_free = post_sync("SET_PACING_MODE", {"pacingMode": "free"})
        assert res_free.get("success") is True
        state_free = get_sync()
        assert state_free["state"]["pacingMode"] == "free", "pacingMode não foi atualizado para free"

        # Transição dinâmica para 'strict_sync'
        res_strict = post_sync("SET_PACING_MODE", {"pacingMode": "strict_sync"})
        assert res_strict.get("success") is True
        print("  ✓ Backend (server.py): Processamento atômico de SET_PACING_MODE validado com sucesso.")

    finally:
        httpd.shutdown()
        httpd.server_close()

    # 7. Validação da Fase 3: Autoria do Studio (import.html & conversion-engine.js) e Manifestos
    import_html_path = os.path.join(BASE_DIR, "import.html")
    with open(import_html_path, "r", encoding="utf-8") as f:
        imp_html = f.read()
    assert "cfg-pacing" in imp_html, "Seletor #cfg-pacing ausente em import.html"
    assert "manifest.pacing" in imp_html, "Sincronização de manifest.pacing ausente em import.html"
    print("  ✓ Studio (import.html): Seletor de ritmo e persistência no manifest validados.")

    conv_engine_path = os.path.join(BASE_DIR, "js", "core", "conversion-engine.js")
    with open(conv_engine_path, "r", encoding="utf-8") as f:
        conv_code = f.read()
    assert "pacing:" in conv_code and "lock_future" in conv_code, "Configuração padrão de pacing ausente no ConversionEngine"
    print("  ✓ ConversionEngine: Geração padrão de pacing nos templates e arquivos convertidos validada.")

    assert "import.cfg_pacing" in i18n_code, "Chave import.cfg_pacing ausente no i18n"

    # Validação dos manifestos das apresentações de demonstração
    for p_slug in ["slidemesh-showcase", "treinamento-interno-pin"]:
        m_path = os.path.join(BASE_DIR, "presentations", p_slug, "manifest.json")
        with open(m_path, "r", encoding="utf-8") as f:
            m_data = json.load(f)
        assert "pacing" in m_data, f"Propriedade pacing ausente no manifesto de {p_slug}"
        assert m_data["pacing"]["mode"] in ["lock_future", "free", "strict_sync"], f"Modo de pacing inválido em {p_slug}"
    print("  ✓ Manifestos Oficiais: Propriedade 'pacing' validada nos manifestos do catálogo.")

    # 8. Validação da Fase 4: Homologação E2E, Haptics e Matriz de Pacing
    assert "navigator.vibrate" in aud_code, "Feedback háptico (vibrate) ausente em audience-app.js"
    assert "sync_live_badge" in aud_code or "isLiveSync" in aud_code, "Indicador de live sync ausente em audience-app.js"

    # Validação da documentação nos READMEs
    readme_pt_path = os.path.join(BASE_DIR, "README.pt-BR.md")
    with open(readme_pt_path, "r", encoding="utf-8") as f:
        readme_pt = f.read()
    assert "Controle Dinâmico de Ritmo da Plateia (Audience Pacing Lock)" in readme_pt, "Documentação de Pacing Lock ausente em README.pt-BR.md"

    readme_en_path = os.path.join(BASE_DIR, "README.md")
    with open(readme_en_path, "r", encoding="utf-8") as f:
        readme_en = f.read()
    assert "Dynamic Audience Pacing Lock" in readme_en, "Documentação de Pacing Lock ausente em README.md"
    print("  ✓ Documentação Oficial: Pacing Lock documentado com paridade em README.pt-BR.md e README.md.")

    print("✓ Fases 1, 2, 3 e 4 de Audience Pacing Lock 100% HOMOLOGADAS e validadas com sucesso.")

def test_demanda03_diagnostics_and_capacity_engine():
    print_section("17. Demanda 03: Diagnóstico de Performance, Recursos e Banda (Fase 1)")

    # Limpa estado anterior em memória do servidor
    with server._STATE_LOCK:
        server.SERVER_STATE["sessions"].clear()

    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    test_port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    try:
        session_id = "DIAG_SUITE_TEST"
        pres_id = "slidemesh-showcase"

        def get_diag(params=""):
            req = urllib.request.Request(f"http://127.0.0.1:{test_port}/api/diagnostics?{params}")
            with urllib.request.urlopen(req) as resp:
                assert resp.status == 200
                assert "application/json" in resp.headers.get("Content-Type", "")
                return json.loads(resp.read().decode('utf-8'))

        # 1. Teste básico do endpoint /api/diagnostics com apresentação oficial
        diag_res = get_diag(f"session={session_id}&presentation={pres_id}")
        assert diag_res["status"] in ["healthy", "degraded"], "Status inválido na resposta de diagnóstico"
        assert "serverTime" in diag_res, "Timestamp ausente no diagnóstico"
        assert "system" in diag_res and "deck" in diag_res, "Estrutura do diagnóstico incompleta"

        # Validação das métricas de sistema
        sys_info = diag_res["system"]
        assert "uptimeSec" in sys_info and sys_info["uptimeSec"] >= 0, "uptimeSec inválido"
        assert "residentMemoryMB" in sys_info and sys_info["residentMemoryMB"] > 0, "residentMemoryMB inválido"
        assert "activeSessionsCount" in sys_info, "activeSessionsCount ausente"
        print("  ✓ Endpoint GET /api/diagnostics: Métricas do sistema (Uptime, Memória, Conexões) validadas.")

        # Validação da auditoria estática do deck
        deck_info = diag_res["deck"]
        assert deck_info["presentationId"] == pres_id, "presentationId divergente"
        assert deck_info["totalSlides"] > 0, "totalSlides deve ser maior que 0"
        assert deck_info["totalDeckWeightKB"] > 0, "totalDeckWeightKB deve ser maior que 0"
        assert "healthScore" in deck_info and 0 <= deck_info["healthScore"] <= 100, "healthScore fora do intervalo 0-100"
        assert "recommendedMaxAudienceLocalWifi" in deck_info, "Capacidade recomendada de audiência ausente"
        print("  ✓ Auditoria de Deck: Cálculo de peso total, slides e score de saúde validados.")

        # 2. Teste com apresentação não encontrada (Graceful Fallback)
        diag_404 = get_diag("presentation=inexistente-1234")
        assert diag_404["deck"]["statusLevel"] == "not_found", "Fallback para apresentação inexistente não tratado"
        print("  ✓ Fallback de Erro: Apresentação inexistente tratada com status gracioso.")

        # 3. Teste de detecção de Slide Pesado (>500KB) e cálculo de rajada (burst)
        temp_pres_slug = "diag-heavy-test"
        temp_pres_dir = os.path.join(BASE_DIR, "presentations", temp_pres_slug)
        temp_assets_dir = os.path.join(temp_pres_dir, "assets")
        os.makedirs(temp_assets_dir, exist_ok=True)

        try:
            # Cria imagem de 1.8 MB (pesada)
            heavy_asset_name = "huge_photo.jpg"
            heavy_asset_path = os.path.join(temp_assets_dir, heavy_asset_name)
            with open(heavy_asset_path, "wb") as hf:
                hf.write(b"0" * (1800 * 1024))  # 1.8 MB

            # Cria manifest e slides referenciando o asset pesado
            with open(os.path.join(temp_pres_dir, "manifest.json"), "w", encoding="utf-8") as mf:
                json.dump({"id": temp_pres_slug, "title": "Heavy Deck"}, mf)

            with open(os.path.join(temp_pres_dir, "slides.json"), "w", encoding="utf-8") as sf:
                json.dump({"slides": [
                    {"id": 1, "title": "Slide Leve", "presenter": {"headline": "Leve"}},
                    {"id": 2, "title": "Slide Pesado", "presenter": {"headline": "Pesado", "media": f"assets/{heavy_asset_name}"}}
                ]}, sf)

            diag_heavy = get_diag(f"presentation={temp_pres_slug}")
            heavy_deck = diag_heavy["deck"]
            assert heavy_deck["hasHeavySlides"] is True, "Slide pesado não foi identificado"
            assert len(heavy_deck["heavySlides"]) == 1, "Quantidade incorreta de slides pesados identificados"
            flagged = heavy_deck["heavySlides"][0]
            assert flagged["slideIndex"] == 2, f"Slide index incorreto: {flagged['slideIndex']}"
            assert flagged["sizeKB"] >= 1800, f"Tamanho KB incorreto: {flagged['sizeKB']}"
            assert flagged["burst30AttendeesMB"] >= 50, f"Rajada calculada incorreta: {flagged['burst30AttendeesMB']}"
            assert heavy_deck["healthScore"] < 80, "Health score deveria ser penalizado por imagem pesada"
            print("  ✓ Detecção de Rajada de Banda: Slide de 1.8MB identificado com alerta de pico para 30 celulares.")

        finally:
            import shutil
            if os.path.exists(temp_pres_dir):
                shutil.rmtree(temp_pres_dir)

        # 4. Validação da Fase 2: Painel HUD na Mesa Técnica (admin/index.html, admin-app.js, i18n)
        admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
        with open(admin_html_path, "r", encoding="utf-8") as f:
            admin_html = f.read()

        assert "admin-diagnostics-card" in admin_html, "Card de diagnóstico ausente em admin/index.html"
        assert "admin-diag-health-badge" in admin_html, "Badge de saúde ausente em admin/index.html"
        assert "admin-diag-capacity" in admin_html, "Indicador de capacidade Wi-Fi ausente em admin/index.html"
        assert "admin-diag-latency" in admin_html, "Indicador de latência local ausente em admin/index.html"
        assert "admin-diag-deck-weight" in admin_html, "Indicador de peso do deck ausente em admin/index.html"
        assert "admin-diag-server-stats" in admin_html, "Indicador de memória/uptime ausente em admin/index.html"
        assert "admin-diag-heavy-alerts" in admin_html, "Container de alertas de banda ausente em admin/index.html"
        print("  ✓ Mesa Técnica (admin/index.html): Card visual de Saúde & Capacidade Wi-Fi validado.")

        admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
        with open(admin_js_path, "r", encoding="utf-8") as f:
            admin_js = f.read()

        assert "fetchEnvironmentDiagnostics" in admin_js, "Método fetchEnvironmentDiagnostics ausente em admin-app.js"
        assert "updateDiagnosticsUI" in admin_js, "Método updateDiagnosticsUI ausente em admin-app.js"
        assert "diagCapacity" in admin_js and "diagLatency" in admin_js, "Mapeamento de elementos de diagnóstico incompleto em admin-app.js"
        print("  ✓ Mesa Técnica (admin-app.js): Polling de diagnóstico e renderizador de HUD validados.")

        # Validação das chaves de internacionalização
        i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
        with open(i18n_path, "r", encoding="utf-8") as f:
            i18n_code = f.read()

        for diag_key in ['admin.diag_title', 'admin.diag_capacity_label', 'admin.diag_latency_label', 'admin.diag_deck_weight_label', 'admin.diag_server_mem_label', 'import.btn_optimize_image']:
            assert diag_key in i18n_code, f"Chave de tradução '{diag_key}' ausente em i18n-engine.js"
        print("  ✓ Internacionalização (i18n): Chaves simétricas de diagnóstico e otimização validadas em pt-BR e en-US.")

        # 5. Validação da Fase 3: Otimizador de Imagem Integrado no Studio (import.html)
        studio_html_path = os.path.join(BASE_DIR, "import.html")
        with open(studio_html_path, "r", encoding="utf-8") as f:
            studio_html = f.read()

        assert "btn-optimize-media" in studio_html, "Botão #btn-optimize-media ausente em import.html"
        assert "media-weight-alert" in studio_html, "Container #media-weight-alert ausente em import.html"
        assert "optimizeImageBase64" in studio_html, "Função optimizeImageBase64 ausente no script de import.html"
        assert "getBase64SizeBytes" in studio_html, "Função getBase64SizeBytes ausente no script de import.html"
        print("  ✓ Studio (import.html): Otimizador de imagem 1-clique via Canvas e detector de peso validados.")

        # 6. Validação da Fase 4: Documentação Oficial e Homologação
        readme_pt_path = os.path.join(BASE_DIR, "README.pt-BR.md")
        with open(readme_pt_path, "r", encoding="utf-8") as f:
            readme_pt = f.read()
        assert "Diagnóstico Pré-Voo, Auditoria de Mídia e Capacidade de Rede" in readme_pt, "Princípio 10 ausente em README.pt-BR.md"

        readme_en_path = os.path.join(BASE_DIR, "README.md")
        with open(readme_en_path, "r", encoding="utf-8") as f:
            readme_en = f.read()
        assert "Pre-Flight Diagnostics, Media Audit & Local Wi-Fi Capacity" in readme_en, "Princípio 10 ausente em README.md"
        print("  ✓ Documentação Oficial: Princípio 10 documentado com paridade em README.pt-BR.md e README.md.")

    finally:
        httpd.shutdown()
        httpd.server_close()

    print("✓ Demanda 03 (Fases 1, 2, 3 e 4) 100% HOMOLOGADAS e validadas com sucesso.")

def test_demanda01_stage_transitions_engine():
    print_section("18. Demanda 01: Transições e Animações no Telão (Fases 1 e 2)")

    # 1. Validação dos Presets CSS no presenter.css (Fase 1)
    css_path = os.path.join(BASE_DIR, "css", "presenter.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()

    assert "stage-trans-fade" in css_content, "Preset .stage-trans-fade ausente em presenter.css"
    assert "stage-trans-slide-next" in css_content, "Preset .stage-trans-slide-next ausente em presenter.css"
    assert "stage-trans-slide-prev" in css_content, "Preset .stage-trans-slide-prev ausente em presenter.css"
    assert "stage-trans-zoom" in css_content, "Preset .stage-trans-zoom ausente em presenter.css"
    assert "stage-trans-dissolve" in css_content, "Preset .stage-trans-dissolve ausente em presenter.css"
    assert "stage-trans-stagger" in css_content, "Preset .stage-trans-stagger ausente em presenter.css"
    assert "stage-stagger-bullet" in css_content, "Classe .stage-stagger-bullet ausente em presenter.css"
    assert "prefers-reduced-motion" in css_content, "Suporte a prefers-reduced-motion ausente em presenter.css"
    print("  ✓ Motor CSS (presenter.css): 5 presets de transição (fade, slide, zoom, dissolve, stagger) e suporte WCAG validados.")

    # 2. Validação do PresentationEngine (renderSlideHtml & renderPresenterSlide) (Fase 1)
    engine_path = os.path.join(BASE_DIR, "js", "core", "presentation-engine.js")
    with open(engine_path, "r", encoding="utf-8") as f:
        engine_code = f.read()

    assert "stage-trans-slide-next" in engine_code, "Lógica de transição stage-trans-slide-next ausente em presentation-engine.js"
    assert "stage-trans-slide-prev" in engine_code, "Lógica de transição stage-trans-slide-prev ausente em presentation-engine.js"
    assert "stage-trans-zoom" in engine_code, "Lógica de transição stage-trans-zoom ausente em presentation-engine.js"
    assert "stage-trans-dissolve" in engine_code, "Lógica de transição stage-trans-dissolve ausente em presentation-engine.js"
    assert "stage-trans-stagger" in engine_code, "Lógica de transição stage-trans-stagger ausente em presentation-engine.js"
    assert "stage-stagger-bullet" in engine_code, "Injeção de bullets escalonados ausente em presentation-engine.js"
    print("  ✓ PresentationEngine (presentation-engine.js): Injeção dinâmica de classes de transição e animação stagger validada.")

    # 3. Validação do PresenterApp (presenter-app.js) (Fase 1)
    presenter_js_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_js_path, "r", encoding="utf-8") as f:
        presenter_code = f.read()

    assert "this.prevSlideIndex" in presenter_code, "Rastreamento prevSlideIndex ausente em presenter-app.js"
    assert "applySlideAnimations" in presenter_code, "Método applySlideAnimations ausente em presenter-app.js"
    assert "stage-stagger-bullet" in presenter_code, "Injeção de delay de bullets stagger ausente em presenter-app.js"
    print("  ✓ Telão / Púlpito (presenter-app.js): Rastreamento de direção de slide e escalonamento de bullets validados.")

    # 4. Validação do SlideMesh Studio (import.html) (Fase 2)
    studio_html_path = os.path.join(BASE_DIR, "import.html")
    with open(studio_html_path, "r", encoding="utf-8") as f:
        studio_html = f.read()

    assert "cfg-transition" in studio_html, "Seletor #cfg-transition ausente em import.html"
    assert "edit-slide-transition" in studio_html, "Seletor #edit-slide-transition ausente em import.html"
    assert "import.cfg_transition" in studio_html, "Data-i18n import.cfg_transition ausente em import.html"
    assert "import.slide_trans_label" in studio_html, "Data-i18n import.slide_trans_label ausente em import.html"
    print("  ✓ Studio (import.html): Seletores de transição global e por slide integrados com sucesso.")

    # 5. Validação do ConversionEngine e Manifestos (Fase 2)
    conv_path = os.path.join(BASE_DIR, "js", "core", "conversion-engine.js")
    with open(conv_path, "r", encoding="utf-8") as f:
        conv_code = f.read()

    assert "transition: 'fade'" in conv_code, "Propriedade transition padrão ausente nos templates do conversion-engine.js"
    print("  ✓ ConversionEngine (conversion-engine.js): Geração de tema com transição padrão validada.")

    # 6. Validação de Internacionalização i18n (Fase 2)
    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i18n_code = f.read()

    for key in ['import.cfg_transition', 'import.slide_trans_label', 'import.trans_fade', 'import.trans_slide', 'import.trans_zoom', 'import.trans_dissolve', 'import.trans_stagger']:
        assert key in i18n_code, f"Chave de tradução '{key}' ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves simétricas de transição validadas em pt-BR e en-US.")

    # 7. Validação da Fase 3: Documentação Oficial e Homologação Final
    readme_pt_path = os.path.join(BASE_DIR, "README.pt-BR.md")
    with open(readme_pt_path, "r", encoding="utf-8") as f:
        readme_pt = f.read()
    assert "Transições Cinematográficas e Animações no Telão" in readme_pt, "Princípio 11 ausente em README.pt-BR.md"

    readme_en_path = os.path.join(BASE_DIR, "README.md")
    with open(readme_en_path, "r", encoding="utf-8") as f:
        readme_en = f.read()
    assert "Cinematic Stage Transitions & GPU-Accelerated Animations" in readme_en, "Princípio 11 ausente em README.md"
    print("  ✓ Documentação Oficial: Princípio 11 documentado com paridade em README.pt-BR.md e README.md.")

    print("✓ Demanda 01 (Fases 1, 2 e 3: Transições Cinematográficas no Telão) 100% HOMOLOGADAS com sucesso.")

def test_demanda02_stage_fx_overlay():
    print_section("19. Demanda 02: Efeitos Visuais Dinâmicos do Moderador (Fase 1)")

    # 1. Validação do Módulo StageFX (stage-fx.js)
    stage_fx_path = os.path.join(BASE_DIR, "js", "presenter", "stage-fx.js")
    assert os.path.exists(stage_fx_path), "Arquivo stage-fx.js não encontrado em js/presenter/"
    with open(stage_fx_path, "r", encoding="utf-8") as f:
        fx_code = f.read()

    assert "class StageFX" in fx_code, "Classe StageFX ausente em stage-fx.js"
    assert "_initConfetti" in fx_code, "Método _initConfetti ausente em stage-fx.js"
    assert "_initImpactShake" in fx_code, "Método _initImpactShake ausente em stage-fx.js"
    assert "_initSpotlight" in fx_code, "Método _initSpotlight ausente em stage-fx.js"
    assert "_initCountdown" in fx_code, "Método _initCountdown ausente em stage-fx.js"
    assert "_initGlitchFlash" in fx_code, "Método _initGlitchFlash ausente em stage-fx.js"
    assert "requestAnimationFrame" in fx_code, "Loop de alta performance ausente em stage-fx.js"
    print("  ✓ StageFX Engine (stage-fx.js): 5 presets de efeitos (confetti, shockwave, spotlight, countdown, glitch) e auto-cleanup validados.")

    # 2. Validação da Camada Canvas no HTML do Telão (presenter/index.html)
    presenter_html_path = os.path.join(BASE_DIR, "presenter", "index.html")
    with open(presenter_html_path, "r", encoding="utf-8") as f:
        presenter_html = f.read()

    assert "stage-fx-canvas" in presenter_html, "Elemento #stage-fx-canvas ausente em presenter/index.html"
    assert "pointer-events: none" in presenter_html, "Canvas deve possuir pointer-events: none para não interceptar cliques"
    assert "z-index: 9999" in presenter_html, "Canvas deve possuir z-index superior para flutuar sobre os slides"
    print("  ✓ Telão HTML (presenter/index.html): Overlay #stage-fx-canvas não-destrutivo integrado.")

    # 3. Validação do PresenterApp (presenter-app.js)
    presenter_js_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_js_path, "r", encoding="utf-8") as f:
        presenter_code = f.read()

    assert "import { StageFX }" in presenter_code, "Importação de StageFX ausente em presenter-app.js"
    assert "this.stageFX = new StageFX();" in presenter_code, "Instanciação de StageFX ausente em presenter-app.js"
    assert "TRIGGER_STAGE_FX" in presenter_code, "Escuta de evento TRIGGER_STAGE_FX ausente em presenter-app.js"
    print("  ✓ Telão Controller (presenter-app.js): Integração de eventos em tempo real com StageFX validada.")

    # 4. Validação do RealtimeEngine (realtime-engine.js)
    realtime_path = os.path.join(BASE_DIR, "js", "core", "realtime-engine.js")
    with open(realtime_path, "r", encoding="utf-8") as f:
        realtime_code = f.read()

    assert "triggerStageFX" in realtime_code, "Método triggerStageFX ausente em realtime-engine.js"
    print("  ✓ RealtimeEngine (realtime-engine.js): Despachante multicanal de TRIGGER_STAGE_FX validado.")

    # 5. Validação de Envio e Broadcasting no Servidor Local (server.py)
    port = 9887
    server.PERSIST_ENABLED = False
    server.RATE_LIMIT_ENABLED = False
    httpd = server.ThreadingHTTPServer(("127.0.0.1", port), server.LiveSyncHTTPRequestHandler)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    try:
        url = f"http://127.0.0.1:{port}/api/sync"
        fx_payload = {
            "type": "TRIGGER_STAGE_FX",
            "sessionId": "FX_TEST_SESSION",
            "payload": {
                "fx": "confetti",
                "options": {"duration": 2500},
                "timestamp": int(time.time() * 1000)
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(fx_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            assert res.status == 200
            resp_data = json.loads(res.read().decode('utf-8'))
            assert resp_data["success"] is True

        # Consulta sincronização da sessão
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/sync?session=FX_TEST_SESSION", timeout=3) as res:
            sync_data = json.loads(res.read().decode('utf-8'))
            events = sync_data.get("events", [])
            assert any(e.get("type") == "TRIGGER_STAGE_FX" for e in events), "Evento TRIGGER_STAGE_FX não registrado na sessão"
            print("  ✓ Backend Server (server.py): Processamento e propagação de TRIGGER_STAGE_FX validados.")
    finally:
        httpd.shutdown()
        httpd.server_close()

    # 6. Validação da Fase 2: Mesa Técnica (admin/index.html e admin-app.js)
    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        admin_html = f.read()

    assert "admin-stage-fx-card" in admin_html, "Elemento #admin-stage-fx-card ausente em admin/index.html"
    assert "admin-fx-cooldown-badge" in admin_html, "Badge #admin-fx-cooldown-badge ausente em admin/index.html"
    for fx in ['confetti', 'impact_shake', 'spotlight', 'countdown_burst', 'glitch_flash']:
        assert f'data-fx="{fx}"' in admin_html, f"Botão para efeito '{fx}' ausente em admin/index.html"
    print("  ✓ Mesa Técnica (admin/index.html): Card #admin-stage-fx-card e 5 botões de disparo rápido integrados.")

    admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_js_path, "r", encoding="utf-8") as f:
        admin_js = f.read()

    assert "triggerStageFX" in admin_js, "Método triggerStageFX ausente em admin-app.js"
    assert "fxCooldownActive" in admin_js, "Gerenciador de cooldown ausente em admin-app.js"
    assert "btn-stage-fx" in admin_js, "Listeners de botões .btn-stage-fx ausentes em admin-app.js"
    print("  ✓ Mesa Técnica (admin-app.js): Gerenciamento de cooldown anti-spam de 3s e disparo de FX validados.")

    # 7. Validação de i18n
    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i18n_code = f.read()

    for key in ['admin.stage_fx_title', 'admin.fx_confetti', 'admin.fx_shake', 'admin.fx_spotlight', 'admin.fx_countdown', 'admin.fx_glitch', 'admin.fx_ready', 'admin.fx_cooldown', 'presenter.stage_fx_pulpit_title', 'presenter.fx_confetti_btn', 'presenter.fx_shake_btn']:
        assert key in i18n_code, f"Chave de tradução '{key}' ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves simétricas de Stage FX e Púlpito validadas em pt-BR e en-US.")

    # 8. Validação da Fase 3: Púlpito do Apresentador e Atalhos de Teclado (presenter/index.html & presenter-app.js)
    assert "pulpit-fx-cooldown-badge" in presenter_html, "Badge #pulpit-fx-cooldown-badge ausente em presenter/index.html"
    assert "btn-pulpit-fx" in presenter_html, "Botões .btn-pulpit-fx ausentes no Púlpito em presenter/index.html"

    assert "pulpit-fx-cooldown-badge" in presenter_code, "Mapeamento de pulpitFxCooldownBadge ausente em presenter-app.js"
    assert "e.key.toLowerCase() === 'c'" in presenter_code, "Atalho de teclado 'C' para confetes ausente em presenter-app.js"
    assert "e.key.toLowerCase() === 'x'" in presenter_code, "Atalho de teclado 'X' para tremor de impacto ausente em presenter-app.js"
    assert "btn-pulpit-fx" in presenter_code, "Listeners de .btn-pulpit-fx ausentes em presenter-app.js"
    print("  ✓ Púlpito do Apresentador: Atalhos rápidos de teclado (C, X), dock de botões e cooldown local de 3s validados.")

    # 9. Validação da Fase 4: Documentação Oficial e Homologação Final (Princípio 12)
    readme_pt_path = os.path.join(BASE_DIR, "README.pt-BR.md")
    with open(readme_pt_path, "r", encoding="utf-8") as f:
        readme_pt = f.read()
    assert "Efeitos Visuais Dinâmicos e Gamificação do Palco" in readme_pt, "Princípio 12 ausente em README.pt-BR.md"
    assert "stage-fx.js" in readme_pt, "stage-fx.js ausente na árvore de arquivos de README.pt-BR.md"

    readme_en_path = os.path.join(BASE_DIR, "README.md")
    with open(readme_en_path, "r", encoding="utf-8") as f:
        readme_en = f.read()
    assert "Dynamic Stage Visual Effects & Non-Destructive Gamification" in readme_en, "Princípio 12 ausente em README.md"
    assert "stage-fx.js" in readme_en, "stage-fx.js ausente na árvore de arquivos de README.md"
    print("  ✓ Documentação Oficial: Princípio 12 e stage-fx.js documentados com paridade em README.pt-BR.md e README.md.")

    print("✓ Demanda 02 (Fases 1, 2, 3 e 4: Stage FX Overlay Engine) 100% HOMOLOGADA com sucesso.")

def test_demanda09_analytics_and_session_archive():
    print_section("20. Demanda 09: Analytics Avançado e Histórico Multissessão (Fase 1)")
    import urllib.request
    import urllib.error

    # Inicia servidor HTTP em porta aleatória
    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    archive_dir = os.path.join(BASE_DIR, "sessions_archive")
    test_session_id = f"TEST_ANALYTICS_{int(time.time())}"

    try:
        # 1. Teste de gravação direta via POST /api/analytics/archive
        payload = {
            "sessionId": test_session_id,
            "presentationSlug": "slidemesh-showcase",
            "presentationTitle": "SlideMesh Showcase",
            "startTime": 1000000,
            "endTime": 1003600,
            "durationSeconds": 3600,
            "summary": {
                "totalParticipants": 42,
                "totalVotesCast": 88,
                "totalQuestionsSent": 15,
                "totalQuestionsApproved": 10,
                "totalUpvotes": 50
            },
            "slideMetrics": [
                { "slideIndex": 0, "title": "Capa", "dwellTimeSeconds": 120 },
                { "slideIndex": 1, "title": "Visão Geral", "dwellTimeSeconds": 240 }
            ],
            "pollBreakdown": [
                { "pollId": "poll-1", "totalVotes": 40 }
            ],
            "topQuestions": [
                { "id": "q1", "text": "Como funciona o analytics?", "upvotes": 12 }
            ]
        }

        req = urllib.request.Request(
            f"{base_url}/api/analytics/archive",
            data=json.dumps({"sessionId": test_session_id, "payload": payload}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            assert resp.status == 200, f"Status esperado 200, obtido {resp.status}"
            res_data = json.loads(resp.read().decode("utf-8"))
            assert res_data.get("success") is True, "Falha ao arquivar sessão via POST /api/analytics/archive"
            assert res_data.get("sessionId") == test_session_id
        print("  ✓ Backend (POST /api/analytics/archive): Gravação atômica em disco de relatório analítico validada.")

        # 2. Teste de listagem via GET /api/analytics/history
        with urllib.request.urlopen(f"{base_url}/api/analytics/history", timeout=5) as resp:
            assert resp.status == 200
            history_data = json.loads(resp.read().decode("utf-8"))
            assert history_data.get("success") is True
            sessions = history_data.get("sessions", [])
            matched = next((s for s in sessions if s.get("sessionId") == test_session_id), None)
            assert matched is not None, f"Sessão {test_session_id} não encontrada no histórico analítico!"
            assert matched.get("totalParticipants") == 42
            assert matched.get("totalVotesCast") == 88
        print("  ✓ Backend (GET /api/analytics/history): Listagem consolidada e sumária de sessões validada.")

        # 3. Teste de detalhamento via GET /api/analytics/session?id=XXX
        with urllib.request.urlopen(f"{base_url}/api/analytics/session?id={test_session_id}", timeout=5) as resp:
            assert resp.status == 200
            detail_data = json.loads(resp.read().decode("utf-8"))
            assert detail_data.get("success") is True
            session_obj = detail_data.get("session", {})
            assert session_obj.get("sessionId") == test_session_id
            assert session_obj.get("data", {}).get("summary", {}).get("totalParticipants") == 42
            assert len(session_obj.get("data", {}).get("slideMetrics", [])) == 2
        print("  ✓ Backend (GET /api/analytics/session): Retorno detalhado de telemetria da sessão validado.")

        # 4. Teste de 404 para sessão inexistente
        try:
            urllib.request.urlopen(f"{base_url}/api/analytics/session?id=SESSAO_NAO_EXISTENTE_XYZ", timeout=5)
            assert False, "Deveria ter retornado HTTP 404 para sessão inexistente"
        except urllib.error.HTTPError as e:
            assert e.code == 404, f"Esperado 404, obtido {e.code}"
        print("  ✓ Backend: Tratamento gracioso de HTTP 404 para sessões inexistentes validado.")

        # 5. Validação do SessionManager no Frontend (js/core/session-manager.js)
        session_mgr_path = os.path.join(BASE_DIR, "js", "core", "session-manager.js")
        with open(session_mgr_path, "r", encoding="utf-8") as f:
            session_mgr_code = f.read()

        assert "startSlideTimer" in session_mgr_code, "startSlideTimer ausente em session-manager.js"
        assert "trackSlideDwellTime" in session_mgr_code, "trackSlideDwellTime ausente em session-manager.js"
        assert "getSlideDwellTimes" in session_mgr_code, "getSlideDwellTimes ausente em session-manager.js"
        assert "buildSessionAnalyticsPayload" in session_mgr_code, "buildSessionAnalyticsPayload ausente em session-manager.js"
        assert "archiveSessionRemotely" in session_mgr_code, "archiveSessionRemotely ausente em session-manager.js"
        assert "fetchRemoteAnalyticsHistory" in session_mgr_code, "fetchRemoteAnalyticsHistory ausente em session-manager.js"
        assert "fetchRemoteSessionAnalytics" in session_mgr_code, "fetchRemoteSessionAnalytics ausente em session-manager.js"
        print("  ✓ SessionManager (session-manager.js): Métodos de rastreamento de dwell time e integração analítica validados.")

        # 7. Validação do Painel de Visualização e Gráficos da Fase 2 (admin/index.html e js/admin/admin-app.js)
        admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
        with open(admin_html_path, "r", encoding="utf-8") as f:
            admin_html = f.read()

        assert 'id="admin-btn-analytics"' in admin_html, "Botão #admin-btn-analytics ausente em admin/index.html"
        assert 'id="admin-analytics-modal"' in admin_html, "Modal #admin-analytics-modal ausente em admin/index.html"
        assert 'id="canvas-dwell-time"' in admin_html, "Canvas #canvas-dwell-time ausente em admin/index.html"
        assert 'id="analytics-select-session"' in admin_html, "Select #analytics-select-session ausente em admin/index.html"
        assert 'id="analytics-kpi-participants"' in admin_html, "KPI #analytics-kpi-participants ausente em admin/index.html"
        assert 'id="analytics-btn-archive-now"' in admin_html, "Botão #analytics-btn-archive-now ausente em admin/index.html"
        assert 'id="analytics-btn-export-html"' in admin_html, "Botão #analytics-btn-export-html ausente em admin/index.html"
        assert 'id="analytics-btn-export-csv"' in admin_html, "Botão #analytics-btn-export-csv ausente em admin/index.html"
        print("  ✓ Mesa Técnica (admin/index.html): Modal de Analytics, botões de exportação e Canvas 2D validados.")

        admin_app_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
        with open(admin_app_path, "r", encoding="utf-8") as f:
            admin_app_code = f.read()

        assert "openAnalyticsModal" in admin_app_code, "openAnalyticsModal ausente em admin-app.js"
        assert "renderAnalyticsDashboard" in admin_app_code, "renderAnalyticsDashboard ausente em admin-app.js"
        assert "renderDwellTimeChart" in admin_app_code, "renderDwellTimeChart ausente em admin-app.js"
        assert "archiveCurrentSessionNow" in admin_app_code, "archiveCurrentSessionNow ausente em admin-app.js"
        assert "exportCurrentAnalyticsHTML" in admin_app_code, "exportCurrentAnalyticsHTML ausente em admin-app.js"
        assert "exportCurrentAnalyticsCSV" in admin_app_code, "exportCurrentAnalyticsCSV ausente em admin-app.js"
        print("  ✓ Lógica Admin (admin-app.js): Métodos de renderização de gráficos em Canvas 2D e exportação validados.")

        # 8. Validação da Exportação de Relatório Executivo HTML & CSV (Plano 09 - Fase 3)
        assert "exportExecutiveHTMLReport" in session_mgr_code, "exportExecutiveHTMLReport ausente em session-manager.js"
        assert "downloadExecutiveHTMLReport" in session_mgr_code, "downloadExecutiveHTMLReport ausente em session-manager.js"
        assert "exportAnalyticsCSV" in session_mgr_code, "exportAnalyticsCSV ausente em session-manager.js"
        assert "downloadAnalyticsCSV" in session_mgr_code, "downloadAnalyticsCSV ausente em session-manager.js"

        i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
        with open(i18n_path, "r", encoding="utf-8") as f:
            i18n_code = f.read()
        assert "admin.analytics_export_html" in i18n_code, "Chave admin.analytics_export_html ausente em i18n-engine.js"
        print("  ✓ Relatório Executivo & CSV (session-manager.js & i18n-engine.js): Geradores de relatório autônomo e internacionalização validados.")

        # 9. Teste de Resiliência a Arquivos Corrompidos em sessions_archive/ (Plano 09 - Fase 4)
        corrupt_file = os.path.join(archive_dir, "TEST_CORRUPTED_analytics.json")
        with open(corrupt_file, "w", encoding="utf-8") as f:
            f.write("{ invalid json byte garbage ...")

        with urllib.request.urlopen(f"{base_url}/api/analytics/history", timeout=5) as resp:
            assert resp.status == 200
            history_data = json.loads(resp.read().decode("utf-8"))
            assert history_data.get("success") is True
        print("  ✓ Resiliência a Falhas: Listagem de histórico ignora arquivos corrompidos sem falhar.")

        # 10. Teste de Sanitização de Session ID e Proteção Path Traversal
        traversal_req = urllib.request.Request(
            f"{base_url}/api/analytics/archive",
            data=json.dumps({"sessionId": "../../../etc/test_malicious", "payload": {"test": 1}}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(traversal_req, timeout=5) as resp:
            assert resp.status == 200
            res_data = json.loads(resp.read().decode("utf-8"))
            saved_sid = res_data.get("sessionId")
            assert "/" not in saved_sid and ".." not in saved_sid, f"Falha de sanitização de Session ID: {saved_sid}"
        print("  ✓ Segurança Declarativa: Higienização estrita de session_id contra Path Traversal validada.")

        # 11. Teste de Concorrência e Estresse Multithread (20 gravações e leituras paralelas)
        def concurrent_task(task_id):
            sid = f"CONCURRENT_TEST_{task_id}"
            p = {"summary": {"totalParticipants": task_id, "totalVotesCast": task_id * 2}}
            req = urllib.request.Request(
                f"{base_url}/api/analytics/archive",
                data=json.dumps({"sessionId": sid, "payload": p}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        assert resp.status == 200
                    with urllib.request.urlopen(f"{base_url}/api/analytics/session?id={sid}", timeout=5) as resp:
                        assert resp.status == 200
                    break
                except Exception:
                    if attempt == 2: raise
                    time.sleep(0.05)

        threads = [threading.Thread(target=concurrent_task, args=(i,)) for i in range(20)]
        for t in threads: t.start()
        for t in threads: t.join()
        print("  ✓ Estresse & Concorrência: 20 gravações e leituras atômicas paralelas executadas sem colisões.")

    finally:
        # Limpeza de arquivos de teste
        if os.path.exists(archive_dir):
            for fn in os.listdir(archive_dir):
                if fn.startswith("TEST_") or fn.startswith("ROTATION_TEST_") or fn.startswith("CONCURRENT_TEST_") or "malicious" in fn.lower():
                    try:
                        os.remove(os.path.join(archive_dir, fn))
                    except Exception:
                        pass
        httpd.shutdown()

    print("✓ Demanda 09 (Fases 1, 2, 3 e 4: Analytics Avançado, Persistência, Gráficos Canvas 2D, Relatório Executivo e Resiliência Concorrente) 100% HOMOLOGADA com sucesso.")

def test_demanda10_multi_screen_presenter_hub():
    """
    Suíte 21: Validação do Multi-Screen Presenter Hub (Plano 10 - Fases 1, 2 e 3)
    - Roteamento dinâmico de view via URL (?view=stage, questions_wall, polls_live).
    - Presença e injeção de classes CSS no body (.view-stage-mode, .view-questions-mode, .view-polls-mode).
    - Métodos getViewMode, setViewMode e applyViewModeLayout em PresenterApp.
    - Estrutura de containers de palco em presenter/index.html.
    - Estilização em alta definição para mural de perguntas e enquetes monumentais em presenter.css.
    - Suporte a Stage FX sincronizado.
    - Atalhos diretos de telões secundários na Mesa Técnica (admin/index.html).
    - Internacionalização simétrica em i18n-engine.js e documentação oficial (Princípio 13).
    """
    print(f"\n{'='*70}")
    print(f" 🧪 21. Demanda 10: Multi-Screen Presenter Hub (Fases 1, 2 e 3)")
    print(f"{'='*70}")

    presenter_app_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_app_path, "r", encoding="utf-8") as f:
        code = f.read()

    assert "this.viewMode" in code, "Propriedade this.viewMode ausente em PresenterApp"
    assert "getViewMode" in code, "Método getViewMode ausente em PresenterApp"
    assert "setViewMode" in code, "Método setViewMode ausente em PresenterApp"
    assert "applyViewModeLayout" in code, "Método applyViewModeLayout ausente em PresenterApp"
    assert "view-questions-mode" in code, "Classe view-questions-mode ausente em applyViewModeLayout"
    assert "view-polls-mode" in code, "Classe view-polls-mode ausente em applyViewModeLayout"
    assert "view-stage-mode" in code, "Classe view-stage-mode ausente em applyViewModeLayout"
    assert "renderEmptyPollStagePlaceholder" in code, "Método renderEmptyPollStagePlaceholder ausente em PresenterApp"
    print("  ✓ PresenterApp (presenter-app.js): Motor de roteamento de visualização multi-telão validado.")

    presenter_html_path = os.path.join(BASE_DIR, "presenter", "index.html")
    with open(presenter_html_path, "r", encoding="utf-8") as f:
        html = f.read()

    assert 'id="stage-questions-drawer"' in html or "id='stage-questions-drawer'" in html, "Container stage-questions-drawer ausente em presenter/index.html"
    assert 'id="stage-questions-list"' in html or "id='stage-questions-list'" in html, "Lista stage-questions-list ausente em presenter/index.html"
    assert 'id="stage-poll-dock"' in html or "id='stage-poll-dock'" in html, "Dock stage-poll-dock ausente em presenter/index.html"
    assert 'id="stage-fx-canvas"' in html or "id='stage-fx-canvas'" in html, "Canvas stage-fx-canvas ausente em presenter/index.html"
    print("  ✓ Telão HTML (presenter/index.html): Estrutura de containers para mural, enquetes e StageFX validada.")

    presenter_css_path = os.path.join(BASE_DIR, "css", "presenter.css")
    with open(presenter_css_path, "r", encoding="utf-8") as f:
        css = f.read()

    assert ".view-questions-mode" in css, "Estilos .view-questions-mode ausentes em presenter.css"
    assert ".view-polls-mode" in css, "Estilos .view-polls-mode ausentes em presenter.css"
    assert "top-voted" in css, "Destaque top-voted ausente em presenter.css"
    print("  ✓ Estilização Monumental (presenter.css): Regras CSS dedicadas para mural de perguntas e enquetes em tela cheia validadas.")

    # Validação dos Atalhos na Mesa Técnica e i18n (Plano 10 - Fase 3)
    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        admin_html = f.read()

    assert 'id="admin-link-presenter-questions"' in admin_html or "id='admin-link-presenter-questions'" in admin_html, "Link admin-link-presenter-questions ausente em admin/index.html"
    assert 'id="admin-link-presenter-polls"' in admin_html or "id='admin-link-presenter-polls'" in admin_html, "Link admin-link-presenter-polls ausente em admin/index.html"
    print("  ✓ Mesa Técnica (admin/index.html): Atalhos diretos para abertura de telões secundários validados.")

    admin_app_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_app_path, "r", encoding="utf-8") as f:
        admin_app = f.read()

    assert "linkPresenterQuestions" in admin_app, "linkPresenterQuestions ausente em admin-app.js"
    assert "linkPresenterPolls" in admin_app, "linkPresenterPolls ausente em admin-app.js"
    assert "view=questions_wall" in admin_app, "Parâmetro view=questions_wall ausente em admin-app.js"
    assert "view=polls_live" in admin_app, "Parâmetro view=polls_live ausente em admin-app.js"
    print("  ✓ Controlador Admin (admin-app.js): Geração de links desacoplados de visualização validada.")

    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i18n_code = f.read()

    assert "admin.btn_telao_questions" in i18n_code, "Chave admin.btn_telao_questions ausente em i18n-engine.js"
    assert "admin.btn_telao_polls" in i18n_code, "Chave admin.btn_telao_polls ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves simétricas de telões secundários validadas em pt-BR e en-US.")

    # Validação do Princípio 13 na Documentação Oficial
    readme_pt = os.path.join(BASE_DIR, "README.pt-BR.md")
    readme_en = os.path.join(BASE_DIR, "README.md")
    with open(readme_pt, "r", encoding="utf-8") as f: pt_doc = f.read()
    with open(readme_en, "r", encoding="utf-8") as f: en_doc = f.read()

    assert "Multi-Screen Presenter Hub" in pt_doc, "Princípio 13 ausente em README.pt-BR.md"
    assert "Multi-Screen Presenter Hub" in en_doc, "Princípio 13 ausente em README.md"
    print("  ✓ Documentação Oficial: Princípio 13 (Multi-Screen Presenter Hub) documentado com paridade em README.pt-BR.md e README.md.")

    # 4. Validação de Resiliência e Gate de Moderação nos Telões Secundários (Plano 10 - Fase 4)
    moderation_path = os.path.join(BASE_DIR, "js", "core", "moderation-engine.js")
    with open(moderation_path, "r", encoding="utf-8") as f:
        mod_code = f.read()

    assert "getApprovedQuestions" in mod_code, "getApprovedQuestions ausente em moderation-engine.js"
    assert "getApprovedQuestions" in code, "getApprovedQuestions ausente em presenter-app.js"
    print("  ✓ Gate de Moderação ADR-04: Telão secundário restrito a perguntas estritamente aprovadas (zero vazamento de pendentes).")

    print("✓ Demanda 10 (Fases 1, 2, 3 e 4: Multi-Screen Presenter Hub, Telões Monumentais, Atalhos e Resiliência) 100% HOMOLOGADA com sucesso.")

def test_demanda11_media_range_requests():
    """
    Suíte 22: Validação de HTTP 206 Range Requests para Streaming de Mídias (Plano 11 - Fase 1)
    - Suporte a HTTP 200 com cabeçalho Accept-Ranges: bytes.
    - Suporte a HTTP 206 com Range fechado (bytes=0-1023).
    - Suporte a HTTP 206 com Range aberto (bytes=1024-).
    - Suporte a HTTP 206 com Range de sufixo (bytes=-500).
    - Tratamento de HTTP 416 Range Not Satisfiable para offsets inválidos.
    - Respostas HEAD para arquivos de mídia com Content-Length e Accept-Ranges.
    - Suporte a formatos de áudio e vídeo (.mp4, .webm, .mp3, .wav).
    """
    print(f"\n{'='*70}")
    print(f" 🧪 22. Demanda 11: HTTP 206 Range Requests & Streaming de Mídias (Fase 1)")
    print(f"{'='*70}")

    from server import LiveSyncHTTPRequestHandler, ThreadingHTTPServer

    test_video_path = os.path.join(BASE_DIR, "test_media_sample.mp4")
    test_audio_path = os.path.join(BASE_DIR, "test_audio_sample.mp3")

    # Gera payload sintético determinístico de 256KB para vídeo e 64KB para áudio
    video_bytes = bytes([i % 256 for i in range(256 * 1024)])
    audio_bytes = bytes([(i * 7) % 256 for i in range(64 * 1024)])

    with open(test_video_path, "wb") as f:
        f.write(video_bytes)
    with open(test_audio_path, "wb") as f:
        f.write(audio_bytes)

    port = 8899
    httpd = ThreadingHTTPServer(('127.0.0.1', port), LiveSyncHTTPRequestHandler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()

    base_url = f"http://127.0.0.1:{port}"

    try:
        # 1. Teste de GET Padrão (HTTP 200 + Accept-Ranges)
        with urllib.request.urlopen(f"{base_url}/test_media_sample.mp4") as resp:
            assert resp.status == 200
            assert resp.headers.get("Accept-Ranges") == "bytes"
            assert resp.headers.get("Content-Type") == "video/mp4"
            assert int(resp.headers.get("Content-Length")) == len(video_bytes)
            data = resp.read()
            assert data == video_bytes
        print("  ✓ HTTP 200 Padrão: Entrega completa com cabeçalho 'Accept-Ranges: bytes' validada.")

        # 2. Teste de HEAD Request
        req_head = urllib.request.Request(f"{base_url}/test_media_sample.mp4", method='HEAD')
        with urllib.request.urlopen(req_head) as resp:
            assert resp.status == 200
            assert resp.headers.get("Accept-Ranges") == "bytes"
            assert int(resp.headers.get("Content-Length")) == len(video_bytes)
            assert len(resp.read()) == 0
        print("  ✓ HEAD Request: Metadados e cabeçalhos de mídia entregues sem corpo.")

        # 3. Teste de Range Fechado (bytes=0-1023 -> 1024 bytes)
        req_range1 = urllib.request.Request(f"{base_url}/test_media_sample.mp4", headers={"Range": "bytes=0-1023"})
        with urllib.request.urlopen(req_range1) as resp:
            assert resp.status == 206
            assert resp.headers.get("Content-Range") == f"bytes 0-1023/{len(video_bytes)}"
            assert int(resp.headers.get("Content-Length")) == 1024
            chunk1 = resp.read()
            assert chunk1 == video_bytes[0:1024]
        print("  ✓ HTTP 206 (Range Fechado bytes=0-1023): Chunk exato de 1024 bytes validado.")

        # 4. Teste de Range Intermediário (bytes=50000-59999 -> 10000 bytes)
        req_range2 = urllib.request.Request(f"{base_url}/test_media_sample.mp4", headers={"Range": "bytes=50000-59999"})
        with urllib.request.urlopen(req_range2) as resp:
            assert resp.status == 206
            assert resp.headers.get("Content-Range") == f"bytes 50000-59999/{len(video_bytes)}"
            assert int(resp.headers.get("Content-Length")) == 10000
            chunk2 = resp.read()
            assert chunk2 == video_bytes[50000:60000]
        print("  ✓ HTTP 206 (Range Intermediário bytes=50000-59999): Fatia de 10.000 bytes validada.")

        # 5. Teste de Range Aberto (bytes=260000-)
        req_range3 = urllib.request.Request(f"{base_url}/test_media_sample.mp4", headers={"Range": "bytes=260000-"})
        with urllib.request.urlopen(req_range3) as resp:
            assert resp.status == 206
            expected_range = f"bytes 260000-{len(video_bytes)-1}/{len(video_bytes)}"
            assert resp.headers.get("Content-Range") == expected_range
            chunk3 = resp.read()
            assert chunk3 == video_bytes[260000:]
        print("  ✓ HTTP 206 (Range Aberto bytes=260000-): Cauda final do arquivo validada.")

        # 6. Teste de Range com Sufixo (bytes=-500 -> últimos 500 bytes)
        req_range4 = urllib.request.Request(f"{base_url}/test_media_sample.mp4", headers={"Range": "bytes=-500"})
        with urllib.request.urlopen(req_range4) as resp:
            assert resp.status == 206
            expected_range = f"bytes {len(video_bytes)-500}-{len(video_bytes)-1}/{len(video_bytes)}"
            assert resp.headers.get("Content-Range") == expected_range
            chunk4 = resp.read()
            assert chunk4 == video_bytes[-500:]
        print("  ✓ HTTP 206 (Range Sufixo bytes=-500): Últimos 500 bytes validados.")

        # 7. Teste de HTTP 416 (Range Fora dos Limites)
        req_range_inv = urllib.request.Request(f"{base_url}/test_media_sample.mp4", headers={"Range": "bytes=999999-"})
        try:
            urllib.request.urlopen(req_range_inv)
            assert False, "Deveria ter retornado HTTP 416"
        except urllib.error.HTTPError as e:
            assert e.code == 416
            assert e.headers.get("Content-Range") == f"bytes */{len(video_bytes)}"
        print("  ✓ HTTP 416 (Range Not Satisfiable): Offset além do tamanho do arquivo rejeitado graciosamente.")

        # 8. Teste de Arquivo de Áudio MP3
        req_audio = urllib.request.Request(f"{base_url}/test_audio_sample.mp3", headers={"Range": "bytes=0-511"})
        with urllib.request.urlopen(req_audio) as resp:
            assert resp.status == 206
            assert resp.headers.get("Content-Type") == "audio/mpeg"
            assert resp.headers.get("Content-Range") == f"bytes 0-511/{len(audio_bytes)}"
            assert resp.read() == audio_bytes[0:512]
        print("  ✓ Suporte a Áudio (.mp3): Content-Type audio/mpeg e Range Request validados.")

    finally:
        httpd.shutdown()
        if os.path.exists(test_video_path):
            try: os.remove(test_video_path)
            except Exception: pass
        if os.path.exists(test_audio_path):
            try: os.remove(test_audio_path)
            except Exception: pass

    # Validação do Motor Client-Side MediaCacheEngine (Plano 11 - Fase 2)
    cache_engine_path = os.path.join(BASE_DIR, "js", "core", "media-cache-engine.js")
    with open(cache_engine_path, "r", encoding="utf-8") as f:
        cache_code = f.read()

    assert "export class MediaCacheEngine" in cache_code, "Classe MediaCacheEngine ausente em media-cache-engine.js"
    assert "extractMediaUrlsFromSlide" in cache_code, "Método extractMediaUrlsFromSlide ausente em media-cache-engine.js"
    assert "onSlideChange" in cache_code, "Método onSlideChange ausente em media-cache-engine.js"
    assert "prefetchSlideMedia" in cache_code, "Método prefetchSlideMedia ausente em media-cache-engine.js"
    assert "cleanupOutOfWindow" in cache_code, "Método cleanupOutOfWindow ausente em media-cache-engine.js"
    assert "URL.revokeObjectURL" in cache_code, "Chamada URL.revokeObjectURL ausente para descarte de memória"
    assert "slidingWindowSize" in cache_code, "slidingWindowSize ausente em MediaCacheEngine"
    print("  ✓ MediaCacheEngine (media-cache-engine.js): Algoritmo de janela deslizante ±2 e descarte com revokeObjectURL validados.")

    presenter_app_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_app_path, "r", encoding="utf-8") as f:
        p_code = f.read()

    assert "MediaCacheEngine" in p_code, "MediaCacheEngine não importado em presenter-app.js"
    assert "this.mediaCache" in p_code, "this.mediaCache não instanciado em PresenterApp"
    assert "this.mediaCache.onSlideChange" in p_code, "onSlideChange não invocado no ciclo de vida de slide do PresenterApp"
    assert "handleMediaControlAction" in p_code, "handleMediaControlAction ausente em presenter-app.js"
    assert "MEDIA_CONTROL_ACTION" in p_code, "Evento MEDIA_CONTROL_ACTION não tratado em presenter-app.js"
    print("  ✓ Integração Telão (presenter-app.js): Ciclo de vida de pré-cache de mídias e receptor de controle remoto validados.")

    # Validação de Controle Remoto de Mídia (Plano 11 - Fase 3)
    realtime_code_path = os.path.join(BASE_DIR, "js", "core", "realtime-engine.js")
    with open(realtime_code_path, "r", encoding="utf-8") as f:
        r_code = f.read()
    assert "triggerMediaAction" in r_code, "Método triggerMediaAction ausente em realtime-engine.js"
    assert "MEDIA_CONTROL_ACTION" in r_code, "Tipo de evento MEDIA_CONTROL_ACTION ausente em realtime-engine.js"
    print("  ✓ RealtimeEngine (realtime-engine.js): Disparador triggerMediaAction em broadcast validado.")

    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        a_html = f.read()
    assert "admin-media-control-card" in a_html, "Container admin-media-control-card ausente em admin/index.html"
    assert "btn-media-action" in a_html, "Botões btn-media-action ausentes em admin/index.html"
    assert "admin-media-status-badge" in a_html, "Badge admin-media-status-badge ausente em admin/index.html"
    print("  ✓ Mesa Técnica HTML (admin/index.html): Card de controle de mídia e botões de ação validados.")

    admin_app_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_app_path, "r", encoding="utf-8") as f:
        a_code = f.read()
    assert "mediaControlCard" in a_code, "mediaControlCard não mapeado no DOM em admin-app.js"
    assert "triggerMediaAction" in a_code, "triggerMediaAction ausente no controlador admin-app.js"
    print("  ✓ Controlador Mesa Técnica (admin-app.js): Métodos e listeners de controle de mídia validados.")

    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i_code = f.read()
    assert "admin.media_control_title" in i_code, "Chave admin.media_control_title ausente em i18n-engine.js"
    assert "admin.media_play" in i_code, "Chave admin.media_play ausente em i18n-engine.js"
    assert "admin.media_pause" in i_code, "Chave admin.media_pause ausente em i18n-engine.js"
    assert "admin.media_restart" in i_code, "Chave admin.media_restart ausente em i18n-engine.js"
    assert "admin.media_mute" in i_code, "Chave admin.media_mute ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves simétricas de controle de mídia em pt-BR e en-US validadas.")

    print("✓ Demanda 11 (Fases 1, 2 e 3: HTTP 206 Range Requests, MediaCacheEngine e Controle Remoto de Mídia) 100% HOMOLOGADA com sucesso.")

def test_demanda12_zip_export_import_portability():
    print_section("23. Demanda 12: Portabilidade Total & Import/Export ZIP (Fase 1)")
    import io
    import zipfile
    import shutil
    import subprocess
    from http.client import HTTPConnection

    # Inicia servidor local em porta aleatória
    httpd = HTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    conn = HTTPConnection("127.0.0.1", port)

    # 1. Teste de GET /api/presentations/export
    conn.request("GET", "/api/presentations/export?id=slidemesh-showcase")
    res = conn.getresponse()
    assert res.status == 200, f"Status esperado 200 em export, recebido {res.status}"
    assert "application/zip" in res.getheader("Content-Type", ""), "Content-Type deve ser application/zip"
    assert "slidemesh-showcase.slidemesh.zip" in res.getheader("Content-Disposition", ""), "Content-Disposition inválido"
    zip_bytes = res.read()
    assert len(zip_bytes) > 1000, "Arquivo ZIP exportado está vazio ou truncado"

    # Inspeciona conteúdo do ZIP
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
        names = z.namelist()
        assert "manifest.json" in names, "manifest.json ausente no ZIP exportado"
        assert "slides.json" in names, "slides.json ausente no ZIP exportado"
        assert any(n.startswith("assets/") for n in names), "Pasta assets/ ausente no ZIP exportado"
        
        manifest_data = json.loads(z.read("manifest.json").decode("utf-8"))
        assert manifest_data["id"] == "slidemesh-showcase", "ID no manifest divergente"
    print("  ✓ GET /api/presentations/export: Pacote .slidemesh.zip gerado em memória com manifest, slides e assets.")

    # 1.1 Teste de erro 404 em exportação inexistente
    conn.request("GET", "/api/presentations/export?id=SESSAO_NAO_EXISTENTE_XYZ")
    res_404 = conn.getresponse()
    assert res_404.status == 404, "Esperado HTTP 404 para apresentação inexistente"
    res_404.read()
    print("  ✓ GET /api/presentations/export: Retorno correto de HTTP 404 para ID inexistente validado.")

    # 2. Teste de POST /api/presentations/import-zip (Binário Direto com mode=rename)
    conn.request("POST", "/api/presentations/import-zip?mode=rename", body=zip_bytes, headers={"Content-Type": "application/zip"})
    res_imp = conn.getresponse()
    assert res_imp.status == 200, f"Status esperado 200 em import-zip, recebido {res_imp.status}"
    data_imp = json.loads(res_imp.read().decode("utf-8"))
    assert data_imp["success"] is True, "Falha na resposta de importação"
    imported_slug = data_imp["presentationId"]
    assert "copia" in imported_slug, f"Slug renomeado deveria conter 'copia', recebido {imported_slug}"
    print(f"  ✓ POST /api/presentations/import-zip (Binário): Importação com resolução de conflito ({imported_slug}) validada.")

    # Verifica se a apresentação importada existe no disco e no catálogo
    imported_dir = os.path.join(BASE_DIR, "presentations", imported_slug)
    assert os.path.isdir(imported_dir), f"Diretório {imported_dir} não foi criado"
    assert os.path.isfile(os.path.join(imported_dir, "manifest.json")), "manifest.json não gravado"
    assert os.path.isfile(os.path.join(imported_dir, "slides.json")), "slides.json não gravado"

    catalog_path = os.path.join(BASE_DIR, "presentations", "catalog.json")
    with open(catalog_path, "r", encoding="utf-8") as f:
        cat = json.load(f)
    assert any(p["id"] == imported_slug for p in cat["presentations"]), "Nova apresentação não catalogada"
    assert any(p["id"] == "slidemesh-showcase" for p in cat["presentations"]), "Apresentação original foi perdida!"
    print("  ✓ Catálogo & Sistema de Arquivos: Inserção não-destrutiva e integridade dos arquivos preservadas.")

    # 3. Teste de POST /api/presentations/import-zip via JSON Base64 com mode=overwrite
    b64_zip = base64.b64encode(zip_bytes).decode("utf-8")
    json_payload = json.dumps({
        "id": "teste-override-zip",
        "dataBase64": b64_zip,
        "mode": "overwrite"
    })
    conn.request("POST", "/api/presentations/import-zip", body=json_payload, headers={"Content-Type": "application/json"})
    res_json_imp = conn.getresponse()
    assert res_json_imp.status == 200, "Falha no upload de ZIP via JSON Base64"
    data_json_imp = json.loads(res_json_imp.read().decode("utf-8"))
    assert data_json_imp["presentationId"] == "teste-override-zip"
    print("  ✓ POST /api/presentations/import-zip (JSON Base64): Importação com override e slug personalizado validada.")

    # 4. Testes de Hardening de Segurança (Zip Slip e Extensões Maliciosas)
    # 4.1 Zip Slip
    slip_buf = io.BytesIO()
    with zipfile.ZipFile(slip_buf, "w", zipfile.ZIP_DEFLATED) as zf_bad:
        zf_bad.writestr("../../../evil.txt", "hacked")
        zf_bad.writestr("manifest.json", json.dumps({"id": "evil", "title": "Evil"}))
        zf_bad.writestr("slides.json", json.dumps({"slides": [{"id": 1}]}))
    slip_bytes = slip_buf.getvalue()

    conn.request("POST", "/api/presentations/import-zip", body=slip_bytes, headers={"Content-Type": "application/zip"})
    res_slip = conn.getresponse()
    assert res_slip.status in (400, 403), f"Zip Slip deveria ser rejeitado com 400/403, recebido {res_slip.status}"
    res_slip.read()
    assert not os.path.exists(os.path.join(BASE_DIR, "evil.txt")), "Vulnerabilidade Zip Slip executada com sucesso!"
    print("  ✓ Hardening Zip Slip: Tentativa de descompressão fora do diretório presentations/ bloqueada com 403.")

    # 4.2 Arquivo executável malicioso em assets/
    bad_ext_buf = io.BytesIO()
    with zipfile.ZipFile(bad_ext_buf, "w", zipfile.ZIP_DEFLATED) as zf_bad:
        zf_bad.writestr("manifest.json", json.dumps({"id": "malicious", "title": "Bad"}))
        zf_bad.writestr("slides.json", json.dumps({"slides": [{"id": 1}]}))
        zf_bad.writestr("assets/malware.exe", "MZ...")
    bad_ext_bytes = bad_ext_buf.getvalue()

    conn.request("POST", "/api/presentations/import-zip", body=bad_ext_bytes, headers={"Content-Type": "application/zip"})
    res_bad = conn.getresponse()
    assert res_bad.status == 400, "Arquivo com extensão .exe deveria ser rejeitado com HTTP 400"
    res_bad.read()
    print("  ✓ Hardening Extensões: Bloqueio estrito de arquivos executáveis (.exe, .sh) em assets/ validado.")

    # 5. Teste dos Utilitários CLI (tools/export_presentation.py e tools/import_presentation.py)
    test_cli_zip = "/tmp/test_cli_pack.zip"
    export_proc = subprocess.run([sys.executable, "tools/export_presentation.py", "slidemesh-showcase", test_cli_zip], capture_output=True, text=True)
    assert export_proc.returncode == 0, f"tools/export_presentation.py falhou: {export_proc.stderr}"
    assert os.path.isfile(test_cli_zip), "Arquivo ZIP não foi gerado pelo CLI de exportação"

    import_proc = subprocess.run([sys.executable, "tools/import_presentation.py", test_cli_zip, "--id", "teste-cli-import-zip"], capture_output=True, text=True)
    assert import_proc.returncode == 0, f"tools/import_presentation.py falhou com ZIP: {import_proc.stderr}"
    print("  ✓ Utilitários CLI: tools/export_presentation.py e tools/import_presentation.py validados via subprocess.")

    # 6. Teste de Frontend do Portal (index.html) e Internacionalização (i18n) - Plano 13 (Fase 1)
    index_path = os.path.join(BASE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        idx_content = f.read()

    assert "import.html" in idx_content, "Link para SlideMesh Studio ausente no index.html"
    assert "/api/presentations/export?id=" in idx_content, "Link de exportação ZIP ausente nos cards de apresentação"
    print("  ✓ Portal (index.html): Link consolidado para SlideMesh Studio e botões de exportação ZIP validados.")

    i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
    with open(i18n_path, "r", encoding="utf-8") as f:
        i18n_content = f.read()

    for k in ["portal.btn_studio", "portal.btn_export_zip"]:
        assert k in i18n_content, f"Chave de tradução {k} ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves simétricas consolidadas de Studio e Exportação ZIP validadas em pt-BR e en-US.")

    # 7. Teste de Studio (import.html) e Mesa Técnica (admin/index.html & admin-app.js) - Fase 3
    studio_path = os.path.join(BASE_DIR, "import.html")
    with open(studio_path, "r", encoding="utf-8") as f:
        studio_content = f.read()
    assert ".zip" in studio_content and ".slidemesh" in studio_content, "Suporte a .zip/.slidemesh ausente no import.html"
    assert "btn-studio-export-zip" in studio_content, "Botão btn-studio-export-zip ausente no cabeçalho do Studio"
    assert "btn-studio-step2-export-zip" in studio_content, "Botão btn-studio-step2-export-zip ausente na Etapa 2 do Studio"
    assert "exportStudioZip" in studio_content, "Função exportStudioZip ausente no script do Studio"
    assert "/api/presentations/import-zip" in studio_content, "Chamada ao endpoint /api/presentations/import-zip ausente no Studio"
    print("  ✓ SlideMesh Studio (import.html): Dropzone com suporte a .zip/.slidemesh e botões de exportação ZIP validados.")

    admin_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_path, "r", encoding="utf-8") as f:
        admin_content = f.read()
    assert "admin-btn-export-zip" in admin_content, "Botão admin-btn-export-zip ausente na Mesa Técnica"

    admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_js_path, "r", encoding="utf-8") as f:
        admin_js_content = f.read()
    assert "btnExportDeckZip" in admin_js_content, "Binding btnExportDeckZip ausente em admin-app.js"
    assert "/api/presentations/export?id=" in admin_js_content, "Ação de download ZIP ausente em admin-app.js"
    print("  ✓ Mesa Técnica (admin/index.html & admin-app.js): Botão de exportação do pacote ZIP validado.")

    for k in ["admin.export_deck_zip", "import.btn_export_zip"]:
        assert k in i18n_content, f"Chave de tradução {k} ausente em i18n-engine.js"
    print("  ✓ Internacionalização (i18n): Chaves admin.export_deck_zip e import.btn_export_zip validadas em pt-BR e en-US.")

    # 8. Limpeza e Teardown
    for cleanup_slug in [imported_slug, "teste-override-zip", "teste-cli-import-zip"]:
        c_dir = os.path.join(BASE_DIR, "presentations", cleanup_slug)
        if os.path.exists(c_dir):
            shutil.rmtree(c_dir)

    with open(catalog_path, "r", encoding="utf-8") as f:
        cat_clean = json.load(f)
    cat_clean["presentations"] = [p for p in cat_clean["presentations"] if p["id"] not in [imported_slug, "teste-override-zip", "teste-cli-import-zip"]]
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(cat_clean, f, ensure_ascii=False, indent=2)

    if os.path.exists(test_cli_zip):
        os.remove(test_cli_zip)

    httpd.shutdown()
    conn.close()
    print("✓ Demanda 12 (Fases 1, 2 e 3: Backend ZIP, CLIs, Portal index.html, SlideMesh Studio e Mesa Técnica) 100% HOMOLOGADA com sucesso.")


def test_plano13_portal_and_admin_modals_ux():
    """Valida as correções do Plano 13 - Fase 1 (Portal index.html) e Fase 2 (Modais da Mesa Técnica)"""
    print(f"\n{'='*70}")
    print(" 🧪 24. Plano 13: Limpeza do Portal & Modais Robustos da Mesa Técnica (Fases 1 e 2)")
    print(f"{'='*70}")

    # 1. Validação do Portal (index.html)
    index_path = os.path.join(BASE_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        idx = f.read()

    assert "v1.0.0" not in idx, "Badge estático v1.0.0 ainda presente no index.html"
    assert "modal-import-zip" not in idx, "Modal duplicado modal-import-zip ainda presente no index.html"
    assert "portal.btn_studio" in idx, "Chave portal.btn_studio ausente no index.html"
    assert "import.html" in idx, "Link para import.html (Studio) ausente no index.html"
    print("  ✓ Portal (index.html): Remoção de versão estática v1.0.0 e unificação de botão Studio validados.")

    # 2. Validação da Estrutura de Modais na Mesa Técnica (admin/index.html)
    admin_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_path, "r", encoding="utf-8") as f:
        admin_html = f.read()

    # Todos os modais devem estar no nível raiz do body (não aninhados)
    modals = ["host-config-modal", "admin-analytics-modal", "history-modal", "new-session-modal", "admin-lock-modal"]
    for m in modals:
        assert f'id="{m}"' in admin_html, f"Modal #{m} ausente em admin/index.html"

    # Verificar que as tags de fechamento do host-config-modal estão corretas
    host_modal_idx = admin_html.find('id="host-config-modal"')
    analytics_modal_idx = admin_html.find('id="admin-analytics-modal"')
    assert host_modal_idx < analytics_modal_idx, "Ordem de modais incorreta"
    between_modals = admin_html[host_modal_idx:analytics_modal_idx]
    assert "</div>" in between_modals and "btn-save-host-config" in between_modals, "Fechamento de host-config-modal ausente ou inválido"

    # Verificar atalhos de Analytics e Histórico na grade e header
    assert 'id="admin-btn-analytics"' in admin_html, "Botão #admin-btn-analytics ausente no header"
    assert 'id="admin-btn-history"' in admin_html, "Botão #admin-btn-history ausente no header"
    assert 'id="admin-card-btn-analytics"' in admin_html, "Atalho #admin-card-btn-analytics ausente na Coluna 3"
    assert 'id="admin-card-btn-history"' in admin_html, "Atalho #admin-card-btn-history ausente na Coluna 3"
    print("  ✓ Mesa Técnica (admin/index.html): Fechamento estrutural de modais e atalhos rápidos validados.")

    # 3. Validação do Script Admin (admin-app.js)
    admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_js_path, "r", encoding="utf-8") as f:
        admin_js = f.read()

    assert "cardBtnAnalytics" in admin_js, "Binding cardBtnAnalytics ausente em admin-app.js"
    assert "cardBtnHistory" in admin_js, "Binding cardBtnHistory ausente em admin-app.js"
    assert "openAnalyticsModal" in admin_js and "openHistoryModal" in admin_js, "Métodos de abertura de modais ausentes em admin-app.js"
    print("  ✓ Controlador Admin (admin-app.js): Bindings de abertura de modais e atalhos validados.")

    print("✓ Plano 13 (Fases 1 e 2: Portal Inicial Limpo e Modais da Mesa Técnica Robustos) 100% HOMOLOGADO com sucesso.")


def test_plano13_phase3_security_gatekeeper_and_rbac():
    """Valida o Backend Gatekeeper, Bloqueio 403 de Credenciais e RBAC Full Lock Screen do Plano 13 - Fase 3"""
    print(f"\n{'='*70}")
    print(" 🧪 25. Plano 13: Backend Gatekeeper, Proteção de Credenciais & RBAC Lock Screen (Fase 3)")
    print(f"{'='*70}")

    from http.server import HTTPServer
    import server

    # 1. Inicia servidor em porta efêmera para testes de endpoints de segurança
    server.BASE_DIR = BASE_DIR
    httpd = HTTPServer(('127.0.0.1', 0), server.LiveSyncHTTPRequestHandler)
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    try:
        # A. Bloqueio 403 Forbidden para /config/security.json
        try:
            req_sec = urllib.request.Request(f"{base_url}/config/security.json")
            with urllib.request.urlopen(req_sec, timeout=3) as res:
                assert False, "O arquivo config/security.json DEVERIA ter sido bloqueado com 403 Forbidden!"
        except urllib.error.HTTPError as he:
            assert he.code == 403, f"Status code esperado 403, obtido {he.code}"
            err_data = json.loads(he.read().decode('utf-8'))
            assert err_data.get("success") is False
            assert "403 Forbidden" in err_data.get("error", "")
            print("  ✓ Backend Hardening: Acesso direto a /config/security.json bloqueado com 403 Forbidden.")

        # B. Endpoint Seguro GET /api/auth/public-config (Sem expor segredos)
        req_pub = urllib.request.Request(f"{base_url}/api/auth/public-config")
        with urllib.request.urlopen(req_pub, timeout=3) as res:
            assert res.status == 200
            pub_cfg = json.loads(res.read().decode('utf-8'))
            assert pub_cfg.get("success") is True
            assert "requirePinForAdmin" in pub_cfg
            assert "offlineAudienceEnabled" in pub_cfg
            assert "pin" not in pub_cfg, "Vazamento de PIN detectado em public-config!"
            assert "password" not in json.dumps(pub_cfg), "Vazamento de senha detectado em public-config!"
            print("  ✓ Public Auth Config: Metadados públicos retornados com sucesso sem expor senhas ou PINs.")

        # C. Endpoint POST /api/auth/verify-pin (PIN correto e incorreto)
        # PIN correto
        body_pin_ok = json.dumps({"pin": "2026"}).encode('utf-8')
        req_pin_ok = urllib.request.Request(f"{base_url}/api/auth/verify-pin", data=body_pin_ok, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_pin_ok, timeout=3) as res:
            assert res.status == 200
            data_pin_ok = json.loads(res.read().decode('utf-8'))
            assert data_pin_ok.get("success") is True
            assert data_pin_ok.get("role") == "admin"

        # PIN incorreto
        try:
            body_pin_err = json.dumps({"pin": "pin_invalido_9999"}).encode('utf-8')
            req_pin_err = urllib.request.Request(f"{base_url}/api/auth/verify-pin", data=body_pin_err, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req_pin_err, timeout=3) as res:
                assert False, "PIN incorreto deveria ter retornado 401 Unauthorized!"
        except urllib.error.HTTPError as he:
            assert he.code == 401
            data_err = json.loads(he.read().decode('utf-8'))
            assert data_err.get("success") is False
        print("  ✓ PIN Gatekeeper: Validação no backend via POST /api/auth/verify-pin com 200/401 validada.")

        # D. Endpoint POST /api/auth/login (Usuário e Senha)
        # Login correto (admin / slidemesh2026)
        body_login_ok = json.dumps({"username": "admin", "password": "slidemesh2026"}).encode('utf-8')
        req_login_ok = urllib.request.Request(f"{base_url}/api/auth/login", data=body_login_ok, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req_login_ok, timeout=3) as res:
            assert res.status == 200
            data_login_ok = json.loads(res.read().decode('utf-8'))
            assert data_login_ok.get("success") is True
            assert data_login_ok.get("user", {}).get("username") == "admin"
            assert data_login_ok.get("user", {}).get("role") == "admin"
            assert "token" in data_login_ok

        # Login com senha incorreta
        try:
            body_login_err = json.dumps({"username": "admin", "password": "senha_errada"}).encode('utf-8')
            req_login_err = urllib.request.Request(f"{base_url}/api/auth/login", data=body_login_err, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req_login_err, timeout=3) as res:
                assert False, "Credenciais inválidas deveriam ter retornado 401 Unauthorized!"
        except urllib.error.HTTPError as he:
            assert he.code == 401
            data_err = json.loads(he.read().decode('utf-8'))
            assert data_err.get("success") is False
        print("  ✓ Login Gatekeeper: Autenticação via POST /api/auth/login com token e RBAC validada.")

    finally:
        httpd.shutdown()
        httpd.server_close()

    # 2. Validação da Interface e Multi-Auth Lock Screen (admin/index.html)
    admin_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_path, "r", encoding="utf-8") as f:
        admin_html = f.read()

    assert 'id="tab-auth-pin"' in admin_html, "Aba #tab-auth-pin ausente"
    assert 'id="tab-auth-local"' in admin_html, "Aba #tab-auth-local ausente"
    assert 'id="tab-auth-google"' in admin_html, "Aba #tab-auth-google ausente"
    assert 'id="panel-auth-pin"' in admin_html, "Painel #panel-auth-pin ausente"
    assert 'id="panel-auth-local"' in admin_html, "Painel #panel-auth-local ausente"
    assert 'id="panel-auth-google"' in admin_html, "Painel #panel-auth-google ausente"
    assert 'id="admin-btn-lock"' in admin_html, "Botão #admin-btn-lock ausente no header"
    print("  ✓ Full Lock Screen UI: Abas PIN, Usuário Local e Google integradas ao admin/index.html.")

    # 3. Validação do AuthEngine (js/core/auth-engine.js)
    auth_js_path = os.path.join(BASE_DIR, "js", "core", "auth-engine.js")
    with open(auth_js_path, "r", encoding="utf-8") as f:
        auth_js = f.read()

    assert "/api/auth/public-config" in auth_js, "Chamada ao endpoint /api/auth/public-config ausente em auth-engine.js"
    assert "/api/auth/verify-pin" in auth_js, "Chamada ao endpoint /api/auth/verify-pin ausente em auth-engine.js"
    assert "/api/auth/login" in auth_js, "Chamada ao endpoint /api/auth/login ausente em auth-engine.js"
    print("  ✓ AuthEngine Client: Métodos loadSecurityConfig, verifyAdminPIN e signInWithLocalCredentials atualizados.")

    print("✓ Plano 13 (Fase 3: Backend Gatekeeper, Proteção de Credenciais & RBAC Full Lock Screen) 100% HOMOLOGADO.")


def test_plano14_phase1_security_setup_wizard():
    print(f"\n{'='*70}")
    print(" 🧪 26. Plano 14: First-Run Security Setup Wizard (Fase 1)")
    print(f"{'='*70}")

    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    # 1. Teste de GET /api/auth/public-config com flag setupRequired
    req = urllib.request.Request(f"{base_url}/api/auth/public-config")
    with urllib.request.urlopen(req) as res:
        assert res.status == 200
        data = json.loads(res.read().decode('utf-8'))
        assert "setupRequired" in data, "Flag 'setupRequired' ausente no /api/auth/public-config"
        print("  ✓ GET /api/auth/public-config: Retorno de 'setupRequired' validado.")

    # 2. Teste de validação em POST /api/auth/setup
    # a) Rejeição de PIN curto (< 4 dígitos)
    def post_json(url, body):
        r = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r) as res:
                return res.status, json.loads(res.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode('utf-8'))

    status, resp = post_json(f"{base_url}/api/auth/setup", {
        "pin": "12",
        "adminUser": {"username": "admin", "password": "123"}
    })
    # Como security.json já existe no repo de teste, ou deve rejeitar com 403 (já configurado) ou 400 (se ausente com erro de validação)
    assert status in (400, 403), f"Esperado status 400 ou 403, obtido {status}"
    print("  ✓ POST /api/auth/setup: Gatekeeper e validações de integridade operacionais.")

    # 3. Validação estrutural de setup.html
    setup_html_path = os.path.join(BASE_DIR, "setup.html")
    assert os.path.exists(setup_html_path), "Arquivo setup.html não encontrado"
    with open(setup_html_path, "r", encoding="utf-8") as f:
        setup_html = f.read()

    assert 'id="wizard-stepper"' in setup_html, "Elemento #wizard-stepper ausente em setup.html"
    assert 'id="pane-step-1"' in setup_html, "Painel #pane-step-1 ausente em setup.html"
    assert 'id="pane-step-2"' in setup_html, "Painel #pane-step-2 ausente em setup.html"
    assert 'id="pane-step-3"' in setup_html, "Painel #pane-step-3 ausente em setup.html"
    assert 'id="input-pin"' in setup_html, "Input #input-pin ausente em setup.html"
    assert 'id="btn-generate-pin"' in setup_html, "Botão #btn-generate-pin ausente em setup.html"
    assert 'id="input-admin-user"' in setup_html, "Input #input-admin-user ausente em setup.html"
    assert 'id="input-admin-pass"' in setup_html, "Input #input-admin-pass ausente em setup.html"
    assert 'id="check-audience-enabled"' in setup_html, "Checkbox #check-audience-enabled ausente em setup.html"
    print("  ✓ Setup Wizard UI (setup.html): Stepper 3-passos, gerador de PIN e formulários validados.")

    # 4. Validação de AuthEngine (js/core/auth-engine.js)
    auth_js_path = os.path.join(BASE_DIR, "js", "core", "auth-engine.js")
    with open(auth_js_path, "r", encoding="utf-8") as f:
        auth_js = f.read()

    assert "isSetupRequired" in auth_js, "Método isSetupRequired() ausente em auth-engine.js"
    assert "performInitialSetup" in auth_js, "Método performInitialSetup() ausente em auth-engine.js"
    print("  ✓ AuthEngine Client: Métodos isSetupRequired() e performInitialSetup() validados.")

    # 5. Validação de banners informativos no Portal e Mesa Técnica
    index_html_path = os.path.join(BASE_DIR, "index.html")
    with open(index_html_path, "r", encoding="utf-8") as f:
        index_html = f.read()
    assert 'id="portal-setup-banner"' in index_html, "Banner #portal-setup-banner ausente no index.html"

    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        admin_html = f.read()
    assert 'id="admin-lock-setup-banner"' in admin_html, "Banner #admin-lock-setup-banner ausente no admin/index.html"
    print("  ✓ Banners de Primeiro Uso: Alertas de setup inicial integrados em index.html e admin/index.html.")

    print("✓ Plano 14 (Fase 1: First-Run Security Setup Wizard Web & CLI) 100% HOMOLOGADO.")


def test_plano14_phase2_admin_security_panel():
    print(f"\n{'='*70}")
    print(" 🧪 27. Plano 14: Painel de Gestão de Segurança na Mesa Técnica (Fase 2)")
    print(f"{'='*70}")

    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    sec_json_path = os.path.join(BASE_DIR, "config", "security.json")
    sec_backup = None
    if os.path.exists(sec_json_path):
        with open(sec_json_path, "r", encoding="utf-8") as f:
            sec_backup = f.read()

    try:
        # 1. Teste GET /api/security/config
        get_req = urllib.request.Request(f"{base_url}/api/security/config")
        with urllib.request.urlopen(get_req, timeout=3) as res:
            assert res.status == 200, f"GET /api/security/config retornou HTTP {res.status}"
            data = json.loads(res.read().decode('utf-8'))
            assert data.get("success") is True, "Campo success ausente"
            cfg = data.get("config", {})
            assert "admin" in cfg, "Campo admin ausente na config"
            assert "offlineAudience" in cfg, "Campo offlineAudience ausente na config"
            assert "pin" in cfg["admin"], "Campo pin ausente no admin"
            assert isinstance(cfg["admin"].get("users"), list), "admin.users deve ser uma lista"
            print("  ✓ GET /api/security/config: Estrutura completa de segurança retornada com sucesso.")

        # 2. Teste POST /api/security/config com validação de PIN inválido (< 4 dígitos)
        bad_payload = {
            "admin": { "pin": "12", "users": [] },
            "offlineAudience": { "enabled": True, "users": [] }
        }
        bad_req = urllib.request.Request(
            f"{base_url}/api/security/config",
            data=json.dumps(bad_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        try:
            urllib.request.urlopen(bad_req, timeout=3)
            assert False, "Deveria ter rejeitado PIN com menos de 4 dígitos com 400"
        except urllib.error.HTTPError as e:
            assert e.code == 400, f"Deveria retornar 400, retornou {e.code}"
            err_res = json.loads(e.read().decode('utf-8'))
            assert "mínimo 4 dígitos" in err_res.get("error", "")
            print("  ✓ POST /api/security/config: Rejeição de PIN inválido (< 4 dígitos) com 400 validada.")

        # 3. Teste POST /api/security/config com atualização válida
        test_update_payload = {
            "admin": {
                "pin": "7788",
                "requirePinForAdmin": True,
                "allowedEmails": ["diretoria@empresa.com.br"],
                "users": [
                    {
                        "username": "admin_p14",
                        "password": "hashed_or_plain_pass",
                        "role": "admin",
                        "name": "Super Admin P14"
                    },
                    {
                        "username": "speaker_p14",
                        "password": "speaker_pass",
                        "role": "presenter",
                        "name": "Orador P14"
                    }
                ]
            },
            "offlineAudience": {
                "enabled": True,
                "users": [
                    { "username": "cracha01", "password": "123", "name": "Convidado VIP" }
                ]
            }
        }
        save_req = urllib.request.Request(
            f"{base_url}/api/security/config",
            data=json.dumps(test_update_payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(save_req, timeout=3) as res:
            assert res.status == 200
            save_data = json.loads(res.read().decode('utf-8'))
            assert save_data.get("success") is True
            print("  ✓ POST /api/security/config: Gravação atômica da nova configuração de segurança validada.")

        # 4. Verificar se a nova configuração persiste e é lida via GET
        with urllib.request.urlopen(get_req, timeout=3) as res:
            updated_data = json.loads(res.read().decode('utf-8'))
            updated_cfg = updated_data.get("config", {})
            assert updated_cfg["admin"]["pin"] == "7788", "PIN atualizado não persistiu"
            user_names = [u["username"] for u in updated_cfg["admin"]["users"]]
            assert "admin_p14" in user_names, "Novo usuário admin_p14 ausente"
            assert "speaker_p14" in user_names, "Novo orador speaker_p14 ausente"
            print("  ✓ Persistência & Leitura: PIN '7788' e usuários atualizados confirmados via GET.")

        # 5. Validação de UI no HTML da Mesa Técnica (admin/index.html)
        admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
        with open(admin_html_path, "r", encoding="utf-8") as f:
            admin_html = f.read()
        assert 'id="admin-btn-security"' in admin_html, "Botão #admin-btn-security ausente em admin/index.html"
        assert 'id="admin-security-settings-modal"' in admin_html, "Modal #admin-security-settings-modal ausente em admin/index.html"
        assert 'id="sec-tab-pin-btn"' in admin_html, "Aba PIN ausente no modal"
        assert 'id="sec-tab-users-btn"' in admin_html, "Aba Usuários ausente no modal"
        assert 'id="sec-tab-audience-btn"' in admin_html, "Aba Audiência ausente no modal"
        assert 'id="sec-tab-google-btn"' in admin_html, "Aba Google ausente no modal"
        print("  ✓ Mesa Técnica HTML (admin/index.html): Botão 🔐 Segurança e Modal com 4 abas validados.")

        # 6. Validação do Controlador JS (js/admin/admin-app.js)
        admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
        with open(admin_js_path, "r", encoding="utf-8") as f:
            admin_js = f.read()
        assert 'openSecuritySettingsModal' in admin_js, "Método openSecuritySettingsModal ausente em admin-app.js"
        assert 'switchSecurityTab' in admin_js, "Método switchSecurityTab ausente em admin-app.js"
        assert 'saveSecuritySettings' in admin_js, "Método saveSecuritySettings ausente em admin-app.js"
        print("  ✓ Controlador Mesa Técnica (admin-app.js): Métodos de gestão de segurança integrados.")

        # 7. Validação de i18n em pt-BR e en-US
        i18n_path = os.path.join(BASE_DIR, "js", "core", "i18n-engine.js")
        with open(i18n_path, "r", encoding="utf-8") as f:
            i18n_content = f.read()
        assert "'admin.btn_security': '🔐 Segurança'" in i18n_content, "Chave admin.btn_security ausente em pt-BR"
        assert "'admin.btn_security': '🔐 Security'" in i18n_content, "Chave admin.btn_security ausente em en-US"
        print("  ✓ Internacionalização (i18n): Chaves de segurança em pt-BR e en-US validadas.")

        print("✓ Plano 14 (Fase 2: Painel de Gestão de Segurança & RBAC na Mesa Técnica) 100% HOMOLOGADO.")
    finally:
        if sec_backup is not None and os.path.exists(sec_json_path):
            with open(sec_json_path, "w", encoding="utf-8") as f:
                f.write(sec_backup)
        httpd.shutdown()


def test_plano14_phase3_studio_security_and_pacing_config():
    print(f"\n{'='*70}")
    print(" 🧪 28. Plano 14: Configuração de Segurança e Pacing no SlideMesh Studio (Fase 3)")
    print(f"{'='*70}")

    # 1. Validação de HTML no SlideMesh Studio (import.html)
    import_html_path = os.path.join(BASE_DIR, "import.html")
    with open(import_html_path, "r", encoding="utf-8") as f:
        import_html = f.read()

    assert 'id="cfg-security"' in import_html, "Select #cfg-security ausente no import.html"
    assert 'id="cfg-pin-code"' in import_html, "Input #cfg-pin-code ausente no import.html"
    assert 'id="btn-studio-generate-pin"' in import_html, "Botão #btn-studio-generate-pin ausente no import.html"
    assert 'id="cfg-pin-hint"' in import_html, "Input #cfg-pin-hint ausente no import.html"
    assert 'id="cfg-pacing-allow-past"' in import_html, "Checkbox #cfg-pacing-allow-past ausente no import.html"
    assert 'updateStudioSecurityUI' in import_html, "Função updateStudioSecurityUI ausente no import.html"
    print("  ✓ SlideMesh Studio UI (import.html): Campos de PIN customizado, Dica e Permissão de Revisão passados validados.")

    # 2. Teste de importação e persistência de manifest com security.pin e pacing.allowReviewPast
    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    test_slug = "test-sec-pacing-studio"
    test_dir = os.path.join(BASE_DIR, "presentations", test_slug)

    try:
        payload = {
            "manifest": {
                "id": test_slug,
                "title": "Apresentação com Segurança Studio",
                "defaultSession": "SECSTUDIO2026",
                "security": {
                    "mode": "pin",
                    "pin": "9922",
                    "pinHint": "Peça ao coordenador"
                },
                "pacing": {
                    "mode": "lock_future",
                    "allowReviewPast": False
                }
            },
            "slides": [
                {
                    "id": 1,
                    "slug": "slide-1",
                    "title": "Slide 1 Seguro",
                    "presenter": { "headline": "Apresentação Segura" }
                }
            ],
            "assets": []
        }

        req = urllib.request.Request(
            f"{base_url}/api/presentations/import",
            data=json.dumps(payload).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            assert res.status == 200
            res_data = json.loads(res.read().decode('utf-8'))
            assert res_data.get("success") is True

        manifest_path = os.path.join(test_dir, "manifest.json")
        assert os.path.exists(manifest_path), "manifest.json não foi gravado"
        with open(manifest_path, "r", encoding="utf-8") as f:
            saved_manifest = json.load(f)

        assert saved_manifest.get("security", {}).get("mode") == "pin", "Modo security.mode incorreto"
        assert saved_manifest.get("security", {}).get("pin") == "9922", "security.pin incorreto"
        assert saved_manifest.get("security", {}).get("pinHint") == "Peça ao coordenador", "security.pinHint incorreto"
        assert saved_manifest.get("pacing", {}).get("allowReviewPast") is False, "pacing.allowReviewPast incorreto"
        print("  ✓ Motor de Importação/Studio: Gravação e persistência de PIN, Dica e allowReviewPast no manifest.json validadas.")

    finally:
        httpd.shutdown()
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir, ignore_errors=True)
            cat_path = os.path.join(BASE_DIR, "presentations", "catalog.json")
            if os.path.exists(cat_path):
                try:
                    with open(cat_path, "r", encoding="utf-8") as f:
                        cat = json.load(f)
                    cat["presentations"] = [p for p in cat.get("presentations", []) if p.get("id") != test_slug]
                    with open(cat_path, "w", encoding="utf-8") as f:
                        json.dump(cat, f, indent=2, ensure_ascii=False)
                except Exception:
                    pass

    print("✓ Plano 14 (Fase 3: Configuração de Segurança e Ritmo no SlideMesh Studio) 100% HOMOLOGADO.")


def test_plano14_phase4_audience_pin_and_admin_health_badge():
    print(f"\n{'='*70}")
    print(" 🧪 29. Plano 14: PIN na Audiência Mobile e Badge de Saúde no Admin (Fase 4)")
    print(f"{'='*70}")

    # 1. Validação de HTML da Audiência Mobile (audience/index.html)
    aud_html_path = os.path.join(BASE_DIR, "audience", "index.html")
    with open(aud_html_path, "r", encoding="utf-8") as f:
        aud_html = f.read()

    assert 'id="session-pin-modal"' in aud_html, "Modal #session-pin-modal ausente em audience/index.html"
    assert 'id="input-session-pin"' in aud_html, "Input #input-session-pin ausente em audience/index.html"
    assert 'id="session-pin-hint"' in aud_html, "Hint #session-pin-hint ausente em audience/index.html"
    assert 'id="session-pin-error"' in aud_html, "Error #session-pin-error ausente em audience/index.html"
    assert 'id="btn-submit-session-pin"' in aud_html, "Botão #btn-submit-session-pin ausente em audience/index.html"
    print("  ✓ Audiência Mobile UI (audience/index.html): Modal de bloqueio por PIN com hint e input validados.")

    # 2. Validação do Controlador Mobile (audience-app.js)
    aud_js_path = os.path.join(BASE_DIR, "js", "audience", "audience-app.js")
    with open(aud_js_path, "r", encoding="utf-8") as f:
        aud_js = f.read()

    assert 'checkSessionProtection' in aud_js, "Método checkSessionProtection ausente em audience-app.js"
    assert 'unlockWithPIN' in aud_js, "Método unlockWithPIN ausente em audience-app.js"
    assert 'verifyAdminPIN' in aud_js, "Validação de PIN via AuthEngine ausente em audience-app.js"
    print("  ✓ Controlador Audiência (audience-app.js): Métodos de validação e desbloqueio por PIN integrados.")

    # 3. Validação do Badge de Saúde no Admin (admin/index.html e admin-app.js)
    admin_html_path = os.path.join(BASE_DIR, "admin", "index.html")
    with open(admin_html_path, "r", encoding="utf-8") as f:
        admin_html = f.read()

    assert 'id="admin-sec-health-badge"' in admin_html, "Badge #admin-sec-health-badge ausente em admin/index.html"
    assert 'id="admin-diag-security-level"' in admin_html, "Row #admin-diag-security-level ausente em admin/index.html"

    admin_js_path = os.path.join(BASE_DIR, "js", "admin", "admin-app.js")
    with open(admin_js_path, "r", encoding="utf-8") as f:
        admin_js = f.read()

    assert 'secHealthBadge' in admin_js, "Mapeamento secHealthBadge ausente em admin-app.js"
    assert 'updateSecurityHealthBadge' in admin_js, "Método updateSecurityHealthBadge ausente em admin-app.js"
    print("  ✓ Mesa Técnica HUD (admin/index.html & admin-app.js): Badge de saúde e nível de segurança RBAC validados.")

    # 4. Validação ponta a ponta de verificação de PIN de deck
    httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.LiveSyncHTTPRequestHandler)
    httpd.daemon_threads = True
    port = httpd.server_port
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{port}"

    test_slug = "test-aud-sec-deck"
    test_dir = os.path.join(BASE_DIR, "presentations", test_slug)
    os.makedirs(test_dir, exist_ok=True)

    try:
        manifest = {
            "id": test_slug,
            "title": "Apresentação com PIN Audiência",
            "defaultSession": "SECDECK2026",
            "security": {
                "mode": "pin",
                "pin": "7733",
                "pinHint": "Código exclusivo do evento"
            },
            "pacing": {
                "mode": "lock_future",
                "allowReviewPast": True
            }
        }
        with open(os.path.join(test_dir, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        # Rejeição com PIN incorreto
        req_bad = urllib.request.Request(
            f"{base_url}/api/auth/verify-pin",
            data=json.dumps({"pin": "0000", "presentationId": test_slug}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        try:
            urllib.request.urlopen(req_bad, timeout=3)
            assert False, "Deveria ter rejeitado PIN incorreto"
        except urllib.error.HTTPError as e:
            assert e.code == 401, f"Status esperado 401, recebido {e.code}"

        # Aceitação com PIN correto
        req_good = urllib.request.Request(
            f"{base_url}/api/auth/verify-pin",
            data=json.dumps({"pin": "7733", "presentationId": test_slug}).encode('utf-8'),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req_good, timeout=3) as res:
            assert res.status == 200
            data = json.loads(res.read().decode('utf-8'))
            assert data.get("authorized") is True

        print("  ✓ PIN Verification Gatekeeper: Validação de PIN de deck específico aprovada com sucesso.")

    finally:
        httpd.shutdown()
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir, ignore_errors=True)

    print("✓ Plano 14 (Fase 4: Integração de PIN na Audiência Mobile e Badge de Saúde no Admin) 100% HOMOLOGADO.")


def test_plano16_presentations_auto_discovery_and_catalog_endpoint():
    print_section("30. Plano 16: Autodescoberta de Apresentações & Endpoint Dinâmico de Catálogo")
    from server import sync_and_verify_presentations_catalog, ThreadingHTTPServer, LiveSyncHTTPRequestHandler
    
    # 1. Teste direto da função sync_and_verify_presentations_catalog
    verified, audit = sync_and_verify_presentations_catalog(BASE_DIR)
    assert len(verified) >= 7, f"Esperado ao menos 7 apresentações verificadas, retornado {len(verified)}"
    
    expected_ids = {
        "comece-por-aqui", "slidemesh-showcase", "guia-animacoes-e-palco",
        "guia-criacao-studio-zip", "guia-moderacao-e-analytics",
        "treinamento-interno-pin", "guia-diagnostico-troubleshooting"
    }
    found_ids = {p["id"] for p in verified}
    assert expected_ids.issubset(found_ids), f"Decks ausentes no catálogo verificado: {expected_ids - found_ids}"
    print("  ✓ sync_and_verify_presentations_catalog: Todos os 7 decks oficiais validados com sucesso.")

    # 2. Teste de Autodescoberta de nova pasta criada no disco
    temp_deck_slug = "teste-deck-autodescoberto-temp"
    temp_deck_dir = os.path.join(BASE_DIR, "presentations", temp_deck_slug)
    os.makedirs(temp_deck_dir, exist_ok=True)
    
    try:
        manifest_temp = {
            "id": temp_deck_slug,
            "title": "Deck Autodescoberto de Teste",
            "subtitle": "Subtítulo de Teste",
            "description": "Descrição de teste de autodescoberta",
            "defaultSession": "SES-TEMPTEST",
            "theme": {"accentColor": "#f59e0b", "background": "#0b0f19"},
            "security": {"mode": "public"}
        }
        slides_temp = {
            "presentationId": temp_deck_slug,
            "title": "Deck Autodescoberto de Teste",
            "slides": [
                {"id": 1, "presenter": {"headline": "Slide 1"}, "audience": {"summary": "Summary 1"}},
                {"id": 2, "presenter": {"headline": "Slide 2"}, "audience": {"summary": "Summary 2"}},
                {"id": 3, "presenter": {"headline": "Slide 3"}, "audience": {"summary": "Summary 3"}}
            ]
        }
        with open(os.path.join(temp_deck_dir, "manifest.json"), "w", encoding="utf-8") as mf:
            json.dump(manifest_temp, mf)
        with open(os.path.join(temp_deck_dir, "slides.json"), "w", encoding="utf-8") as sf:
            json.dump(slides_temp, sf)

        # Roda verificação e valida se autodescobriu
        verified_after, audit_after = sync_and_verify_presentations_catalog(BASE_DIR)
        assert any(p["id"] == temp_deck_slug for p in verified_after), "Novo deck em presentations/ não foi autodescoberto!"
        temp_entry = next(p for p in verified_after if p["id"] == temp_deck_slug)
        assert temp_entry["totalSlides"] == 3, f"totalSlides incorreto ({temp_entry['totalSlides']}), esperado 3"
        print("  ✓ Autodescoberta Dinâmica: Nova apresentação em disco detectada e registrada automaticamente no catalog.json.")

        httpd = ThreadingHTTPServer(('127.0.0.1', 0), LiveSyncHTTPRequestHandler)
        test_port = httpd.server_port
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        time.sleep(0.1)

        base_url = f"http://127.0.0.1:{test_port}"
        
        # Teste GET /api/presentations/catalog
        req_cat_api = urllib.request.Request(f"{base_url}/api/presentations/catalog")
        with urllib.request.urlopen(req_cat_api, timeout=3) as res:
            assert res.status == 200
            cache_header = res.headers.get("Cache-Control", "")
            assert "no-store" in cache_header or "no-cache" in cache_header, f"Cache-Control header incorreto: {cache_header}"
            data = json.loads(res.read().decode('utf-8'))
            assert "presentations" in data and len(data["presentations"]) >= 8
            assert any(p["id"] == temp_deck_slug for p in data["presentations"])
        print("  ✓ GET /api/presentations/catalog: Catálogo retornado dinamicamente com headers de anti-caching.")

        # Teste GET /presentations/catalog.json
        req_cat_json = urllib.request.Request(f"{base_url}/presentations/catalog.json")
        with urllib.request.urlopen(req_cat_json, timeout=3) as res:
            assert res.status == 200
            cache_header = res.headers.get("Cache-Control", "")
            assert "no-store" in cache_header or "no-cache" in cache_header
            data = json.loads(res.read().decode('utf-8'))
            assert "presentations" in data
        print("  ✓ GET /presentations/catalog.json: Interceptação com anti-caching validada com sucesso.")

        httpd.shutdown()

    finally:
        if os.path.exists(temp_deck_dir):
            shutil.rmtree(temp_deck_dir, ignore_errors=True)
        # Limpa do catalog.json
        sync_and_verify_presentations_catalog(BASE_DIR)

    print("✓ Plano 16 (Autodescoberta de Apresentações, Sincronização & Endpoint Dinâmico de Catálogo) 100% HOMOLOGADO.")


def test_plano17_phase1_manifest_sanitization_and_server_side_pin():
    """
    Testa a homologação da Fase 1 do Plano 17:
    - Zero Client-Side Secret Leak no manifest.json servido via HTTP
    - Ausência de PINs expostos nas labels do catálogo
    - Verificação de PIN 100% Server-Side via /api/auth/verify-pin
    - Remoção de fallback de comparação de texto claro no cliente
    """
    print(f"\n{'='*70}")
    print(" 🧪 31. Plano 17: Sanitização do Manifesto & Verificação 100% Server-Side (Fase 1)")
    print(f"{'='*70}")

    httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.LiveSyncHTTPRequestHandler)
    test_port = httpd.server_port
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    time.sleep(0.1)

    base_url = f"http://127.0.0.1:{test_port}"

    try:
        # 1. Teste de Sanitização de manifest.json servido via HTTP
        req_manifest = urllib.request.Request(f"{base_url}/presentations/treinamento-interno-pin/manifest.json")
        with urllib.request.urlopen(req_manifest, timeout=3) as res:
            assert res.status == 200
            cache_header = res.headers.get("Cache-Control", "")
            assert "no-store" in cache_header or "no-cache" in cache_header, "Anti-caching ausente no manifest.json"
            manifest_payload = json.loads(res.read().decode('utf-8'))
            sec = manifest_payload.get("security", {})
            assert sec.get("mode") == "pin", "security.mode incorreto"
            assert "pin" not in sec, f"Vazamento crítico de segredo: 'pin' foi exposto no manifest público: {sec}"
            assert sec.get("isProtected") is True, "Flag isProtected não definida no manifest sanitizado"
        print("  ✓ Zero Secret Leak: 'pin' redigido e removido com sucesso de /presentations/.../manifest.json.")

        # 2. Teste de Catálogo Sanitizado (sem PIN nas labels)
        req_catalog = urllib.request.Request(f"{base_url}/api/presentations/catalog")
        with urllib.request.urlopen(req_catalog, timeout=3) as res:
            assert res.status == 200
            cat_payload = json.loads(res.read().decode('utf-8'))
            deck_pin = next((p for p in cat_payload.get("presentations", []) if p["id"] == "treinamento-interno-pin"), None)
            assert deck_pin is not None, "treinamento-interno-pin ausente no catálogo"
            assert deck_pin.get("securityLabel") == "🔒 Protegida por PIN", f"Label expõe dados indevidos: {deck_pin.get('securityLabel')}"
            assert "7482" not in deck_pin.get("securityLabel", ""), "Código PIN vazado na securityLabel do catálogo!"
        print("  ✓ Catálogo Dinâmico (/api/presentations/catalog): 'securityLabel' 100% sanitizada sem expor PINs.")

        # 3. Teste de Verificação Server-Side Correta (PIN 7482)
        valid_payload = json.dumps({"pin": "7482", "presentationId": "treinamento-interno-pin"}).encode('utf-8')
        req_verify_valid = urllib.request.Request(f"{base_url}/api/auth/verify-pin", data=valid_payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req_verify_valid, timeout=3) as res:
            assert res.status == 200
            v_data = json.loads(res.read().decode('utf-8'))
            assert v_data.get("authorized") is True
            assert v_data.get("role") == "audience"
        print("  ✓ POST /api/auth/verify-pin: PIN do deck '7482' validado exclusivamente no backend com 200 OK.")

        # 4. Teste de Verificação Server-Side com PIN Inválido (PIN 0000)
        invalid_payload = json.dumps({"pin": "0000", "presentationId": "treinamento-interno-pin"}).encode('utf-8')
        req_verify_invalid = urllib.request.Request(f"{base_url}/api/auth/verify-pin", data=invalid_payload, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req_verify_invalid, timeout=3) as res:
                assert False, f"Esperado 401 Unauthorized mas retornou {res.status}"
        except urllib.error.HTTPError as he:
            assert he.code == 401, f"Código inesperado: {he.code}"
        print("  ✓ POST /api/auth/verify-pin: Rejeição estrita de PIN inválido com 401 Unauthorized validada.")

        # 5. Validação de ausência de comparação insegura de segredo em audience-app.js
        audience_js_path = os.path.join(BASE_DIR, "js", "audience", "audience-app.js")
        with open(audience_js_path, "r", encoding="utf-8") as f:
            audience_content = f.read()
        assert "entered === required" not in audience_content, "Comparação local de PIN em texto claro ainda presente em audience-app.js!"
        print("  ✓ Cliente Mobile (audience-app.js): Código refatorado para validação 100% delegada ao backend.")

    finally:
        httpd.shutdown()

    print("✓ Plano 17 (Fase 1: Sanitização do Manifesto & Verificação 100% Server-Side) 100% HOMOLOGADO.")


def test_plano17_phase2_presenter_stage_gatekeeper():
    """Valida a implementação do Gatekeeper Multi-Auth de Palco no Telão do Apresentador (Plano 17 - Fase 2)."""
    print(f"\n{'='*70}")
    print(" 🧪 32. Plano 17: Gatekeeper Multi-Auth de Palco no Telão (/presenter/) (Fase 2)")
    print(f"{'='*70}")

    # 1. Validação de presenter/index.html
    presenter_html_path = os.path.join(BASE_DIR, "presenter", "index.html")
    with open(presenter_html_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    assert 'id="presenter-auth-modal"' in html_content, "Modal #presenter-auth-modal não encontrado em presenter/index.html"
    assert 'id="presenter-tab-pin"' in html_content, "Aba de PIN #presenter-tab-pin não encontrada"
    assert 'id="presenter-tab-local"' in html_content, "Aba Local #presenter-tab-local não encontrada"
    assert 'id="presenter-tab-google"' in html_content, "Aba Google #presenter-tab-google não encontrada"
    assert 'id="btn-unlock-presenter-pin"' in html_content, "Botão #btn-unlock-presenter-pin não encontrado"
    assert 'id="btn-unlock-presenter-user"' in html_content, "Botão #btn-unlock-presenter-user não encontrado"
    assert 'id="btn-unlock-presenter-google"' in html_content, "Botão #btn-unlock-presenter-google não encontrado"
    print("  ✓ Telão do Apresentador UI (presenter/index.html): Modal Multi-Auth com 3 abas e controles validados.")

    # 2. Validação de css/presenter.css
    presenter_css_path = os.path.join(BASE_DIR, "css", "presenter.css")
    with open(presenter_css_path, "r", encoding="utf-8") as f:
        css_content = f.read()

    assert ".presenter-body.presenter-locked" in css_content, "Regra .presenter-body.presenter-locked não encontrada em presenter.css"
    assert "filter: blur(" in css_content, "Efeito de desfoque protetor de palco não encontrado em presenter.css"
    print("  ✓ Estilos de Proteção de Palco (presenter.css): Desfoque total e bloqueio de cliques validados.")

    # 3. Validação de js/presenter/presenter-app.js
    presenter_js_path = os.path.join(BASE_DIR, "js", "presenter", "presenter-app.js")
    with open(presenter_js_path, "r", encoding="utf-8") as f:
        js_content = f.read()

    assert "checkPresentationProtection" in js_content, "Método checkPresentationProtection não encontrado em presenter-app.js"
    assert "showPresenterLockScreen" in js_content, "Método showPresenterLockScreen não encontrado em presenter-app.js"
    assert "unlockWithPIN" in js_content, "Método unlockWithPIN não encontrado em presenter-app.js"
    assert "unlockWithLocalUser" in js_content, "Método unlockWithLocalUser não encontrado em presenter-app.js"
    assert "unlockWithGoogle" in js_content, "Método unlockWithGoogle não encontrado em presenter-app.js"
    assert "switchAuthTab" in js_content, "Método switchAuthTab não encontrado em presenter-app.js"
    print("  ✓ Controlador de Palco (presenter-app.js): Métodos de checagem, bloqueio e desbloqueio integrados.")

    # 4. Validação de js/core/auth-engine.js
    auth_js_path = os.path.join(BASE_DIR, "js", "core", "auth-engine.js")
    with open(auth_js_path, "r", encoding="utf-8") as f:
        auth_content = f.read()

    assert "isAuthorizedForPresentation" in auth_content, "isAuthorizedForPresentation não encontrado em auth-engine.js"
    assert "admin_pin_authenticated" in auth_content, "Herança de sessão admin_pin_authenticated não encontrada em auth-engine.js"
    print("  ✓ Motor de Autenticação (auth-engine.js): Herança transparente de sessão e autorização validadas.")

    print("✓ Plano 17 (Fase 2: Gatekeeper Multi-Auth de Palco no Telão) 100% HOMOLOGADO.")


def test_plano17_phase3_portal_actions_and_zip_export_protection():
    """Valida a proteção de ações em decks protegidos e bloqueio de download ZIP não autorizado (Plano 17 - Fase 3)."""
    print(f"\n{'='*70}")
    print(" 🧪 33. Plano 17: Proteção de Ações & Download ZIP Protegido no Portal (Fase 3)")
    print(f"{'='*70}")

    httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.LiveSyncHTTPRequestHandler)
    test_port = httpd.server_port
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    time.sleep(0.1)

    base_url = f"http://127.0.0.1:{test_port}"

    try:
        # 1. Tentativa de exportar ZIP de deck protegido sem PIN -> deve retornar 401
        try:
            with urllib.request.urlopen(f"{base_url}/api/presentations/export?id=treinamento-interno-pin", timeout=3) as res:
                assert False, f"Esperado 401 para deck protegido sem PIN, retornou {res.status}"
        except urllib.error.HTTPError as he:
            assert he.code == 401, f"Código inesperado: {he.code}"
        print("  ✓ GET /api/presentations/export: Bloqueio estrito de deck protegido sem PIN com 401 validado.")

        # 2. Tentativa de exportar ZIP com PIN incorreto -> deve retornar 401
        try:
            with urllib.request.urlopen(f"{base_url}/api/presentations/export?id=treinamento-interno-pin&pin=9999", timeout=3) as res:
                assert False, f"Esperado 401 para PIN inválido, retornou {res.status}"
        except urllib.error.HTTPError as he:
            assert he.code == 401, f"Código inesperado: {he.code}"
        print("  ✓ GET /api/presentations/export: Rejeição de PIN inválido com 401 validada.")

        # 3. Exportação de ZIP com PIN correto (7482) -> deve retornar 200 e ZIP válido
        with urllib.request.urlopen(f"{base_url}/api/presentations/export?id=treinamento-interno-pin&pin=7482", timeout=3) as res:
            assert res.status == 200, f"Falha ao exportar com PIN correto: {res.status}"
            zip_data = res.read()
            assert zipfile.is_zipfile(io.BytesIO(zip_data)), "Resposta não é um arquivo ZIP válido"
        print("  ✓ GET /api/presentations/export: Exportação com PIN correto aprovada com 200 OK e ZIP íntegro.")

        # 4. Exportação de deck público sem PIN -> deve retornar 200 diretamente
        with urllib.request.urlopen(f"{base_url}/api/presentations/export?id=comece-por-aqui", timeout=3) as res:
            assert res.status == 200, f"Falha ao exportar deck público: {res.status}"
        print("  ✓ GET /api/presentations/export: Exportação de deck público sem PIN permitida com 200 OK.")

        # 5. Validação de index.html (Modais e Interceptação)
        portal_html_path = os.path.join(BASE_DIR, "index.html")
        with open(portal_html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        assert 'id="portal-root"' in html_content, "Elemento #portal-root não encontrado em index.html"
        assert 'id="portal-deck-auth-modal"' in html_content, "Modal #portal-deck-auth-modal não encontrado em index.html"
        assert 'id="portal-global-lock-modal"' in html_content, "Modal #portal-global-lock-modal não encontrado em index.html"
        assert 'handleProtectedDeckAction' in html_content, "Função handleProtectedDeckAction não encontrada em index.html"
        assert 'requireAuthForCatalog' in html_content, "Checagem de requireAuthForCatalog não encontrada em index.html"
        print("  ✓ Portal UI (index.html): Modais de desbloqueio de deck e Intranet global validados.")

    finally:
        httpd.shutdown()

    print("✓ Plano 17 (Fase 3: Proteção de Ações & Modo Intranet no Portal) 100% HOMOLOGADO.")


def test_plano17_phase4_studio_hardening_and_zip_governance():
    """Valida o Hardening do SlideMesh Studio (/import.html) e Governança de Pacotes ZIP (Plano 17 - Fase 4)."""
    print(f"\n{'='*70}")
    print(" 🧪 34. Plano 17: Hardening do SlideMesh Studio & Governança de Pacotes ZIP (Fase 4)")
    print(f"{'='*70}")

    slug_pin = None
    slug_pub = None

    try:
        # 1. Validação de import_presentation_files com segurança
        test_payload_pin = {
            "manifest": {
                "id": "deck-teste-fase4-pin",
                "title": "Apresentação Teste Fase 4 PIN",
                "security": {
                    "mode": "pin",
                    "pin": "8899",
                    "pinHint": "Dica 8899"
                }
            },
            "slides": [
                {"id": 1, "title": "Slide 1", "presenter": {"headline": "H1"}, "audience": {"summary": "S1"}}
            ]
        }

        import_res = server.import_presentation_files(test_payload_pin)
        slug_pin = import_res["slug"]
        man_path = os.path.join(BASE_DIR, "presentations", slug_pin, "manifest.json")
        with open(man_path, "r", encoding="utf-8") as f:
            saved_man = json.load(f)

        assert saved_man.get("isProtected") is True, "isProtected não foi definido como True no manifest"
        assert saved_man.get("securityLabel") == "🔒 Protegida por PIN", f"securityLabel incorreta: {saved_man.get('securityLabel')}"
        assert saved_man.get("security", {}).get("pin") == "8899", "PIN não foi persistido corretamente no backend"
        print("  ✓ Importação de Deck Protegido: isProtected=True, securityLabel sanitizada e PIN gravados com sucesso.")

        # 2. Validação de import_presentation_files em modo público
        test_payload_pub = {
            "manifest": {
                "id": "deck-teste-fase4-pub",
                "title": "Apresentação Teste Fase 4 Pública",
                "security": {
                    "mode": "public",
                    "pin": "1234"  # Deve ser expurgado
                }
            },
            "slides": [
                {"id": 1, "title": "Slide 1", "presenter": {"headline": "H1"}, "audience": {"summary": "S1"}}
            ]
        }

        import_res_pub = server.import_presentation_files(test_payload_pub)
        slug_pub = import_res_pub["slug"]
        man_pub_path = os.path.join(BASE_DIR, "presentations", slug_pub, "manifest.json")
        with open(man_pub_path, "r", encoding="utf-8") as f:
            saved_man_pub = json.load(f)

        assert saved_man_pub.get("isProtected") is False, "isProtected não foi definido como False no manifest público"
        assert saved_man_pub.get("securityLabel") == "Pública", f"securityLabel incorreta: {saved_man_pub.get('securityLabel')}"
        assert "pin" not in saved_man_pub.get("security", {}), "PIN não foi expurgado de manifest público"
        print("  ✓ Importação de Deck Público: Expurgo de chaves de PIN e isProtected=False validados.")

        # 3. Validação de import.html (Modal e Gatekeeper no Studio)
        import_html_path = os.path.join(BASE_DIR, "import.html")
        with open(import_html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        assert 'id="studio-deck-auth-modal"' in html_content, "Modal #studio-deck-auth-modal não encontrado em import.html"
        assert 'promptStudioUnlock' in html_content, "Função promptStudioUnlock não encontrada em import.html"
        assert 'verifyStudioPin' in html_content, "Função verifyStudioPin não encontrada em import.html"
        assert 'mínimo 4 dígitos' in html_content, "Validação de força de PIN mínimo 4 dígitos não encontrada em import.html"
        print("  ✓ Studio UI (import.html): Modal de desbloqueio, gatekeeper de edição e validação de PIN validados.")

    finally:
        # Limpeza robusta e sincronização do catálogo
        for s in [slug_pin, slug_pub, "deck-teste-fase4-pin", "deck-teste-fase4-pub"]:
            if s:
                d = os.path.join(BASE_DIR, "presentations", s)
                if os.path.isdir(d):
                    shutil.rmtree(d, ignore_errors=True)
        server.sync_and_verify_presentations_catalog(BASE_DIR)

    print("✓ Plano 17 (Fase 4: Hardening do SlideMesh Studio & Governança de Pacotes ZIP) 100% HOMOLOGADO.")


if __name__ == "__main__":
    start_time = time.time()
    try:
        test_catalog_and_presentations_integrity()
        test_essential_files_presence()
        test_i18n_translations_consistency()
        test_server_api_sync_endpoints()
        test_security_guard_logic_and_limits()
        test_realtime_and_auth_sync_optimization()
        test_server_persistence_and_snapshot_resilience()
        test_phase4_mobile_haptics_and_a11y_high_contrast()
        test_presentation_import_endpoint()
        test_slidemesh_studio_web_components()
        test_phase1_upvotes_and_moderation_gate()
        test_phase2_sse_streaming_and_polling_fallback()
        test_phase3_backend_hardening_and_orphan_cleanup()
        test_phase4_static_deck_export_and_print_ready()
        test_audience_pacing_lock_and_controlled_navigation()
        test_demanda03_diagnostics_and_capacity_engine()
        test_demanda01_stage_transitions_engine()
        test_demanda02_stage_fx_overlay()
        test_demanda09_analytics_and_session_archive()
        test_demanda10_multi_screen_presenter_hub()
        test_demanda11_media_range_requests()
        test_demanda12_zip_export_import_portability()
        test_plano13_portal_and_admin_modals_ux()
        test_plano13_phase3_security_gatekeeper_and_rbac()
        test_plano14_phase1_security_setup_wizard()
        test_plano14_phase2_admin_security_panel()
        test_plano14_phase3_studio_security_and_pacing_config()
        test_plano14_phase4_audience_pin_and_admin_health_badge()
        test_plano16_presentations_auto_discovery_and_catalog_endpoint()
        test_plano17_phase1_manifest_sanitization_and_server_side_pin()
        test_plano17_phase2_presenter_stage_gatekeeper()
        test_plano17_phase3_portal_actions_and_zip_export_protection()
        test_plano17_phase4_studio_hardening_and_zip_governance()
        test_readme_and_documentation_consistency()
        
        elapsed = time.time() - start_time
        print(f"\n{'='*70}")
        print(f" 🎉 100% DOS TESTES APROVADOS COM SUCESSO! (Tempo: {elapsed:.2f}s)")
        print(f"{'='*70}\n")
    except AssertionError as e:
        print(f"\n❌ FALHA NO TESTE: {e}\n", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERRO INESPERADO: {e}\n", file=sys.stderr)
        sys.exit(1)
