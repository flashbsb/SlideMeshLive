# PLANO 13: ARQUITETURA DE SEGURANÇA (RBAC & GATEKEEPER) E OTIMIZAÇÃO DE UX

## 1. Visão Geral e Contexto

Este plano estabelece as diretrizes de arquitetura, segurança e experiência do usuário para sanar os 3 problemas identificados na plataforma SlideMeshLive:

1. **Portal Inicial (`index.html`):** Remoção de badges de versão estáticos e unificação do fluxo de importação no **SlideMesh Studio** (`import.html`), eliminando redundâncias visuais e modais duplicados.
2. **Mesa Técnica (`admin/index.html`):** Garantia de acionamento instantâneo, feedback visual e fluidez na abertura dos modais de **Histórico de Apresentações** e **Analytics Avançado**.
3. **Segurança Declarativa, RBAC e Gatekeeper:** Implementação de proteção no backend contra vazamento do arquivo `config/security.json`, tela de bloqueio completa (Full Lock Screen) na Mesa Técnica que impede o carregamento antecipado de dados confidenciais, suporte a múltiplos métodos de autenticação (PIN, Usuário/Senha Local e Google Workspace) e proteção para apresentações restritas.

---

## 2. Diagnóstico dos Problemas

### 2.1 Portal Inicial (`index.html`)
- **Badge de Versão:** A indicação estática `v1.0.0` no topo causa ruído e inconsistência.
- **Duplicidade de Importação:** Existiam simultaneamente dois botões ("Importar" que levava ao Studio e "Importar ZIP" que abria um modal local). O **SlideMesh Studio** já suporta nativamente a importação de `.zip`, `.slidemesh`, `.pptx`, `.docx`, `.md`, `.html` e `.pdf` com prévia e resolução de conflitos, tornando o modal do portal redundante e confuso.

### 2.2 Mesa Técnica (`admin/index.html`)
- Os modais de Histórico e Analytics possuem lógica completa em Canvas 2D e armazenamento atômico, mas necessitam de garantia de acionamento desobstruído pós-desbloqueio e atalhos de feedback rápido.

### 2.3 Arquitetura de Segurança (RBAC & Gatekeeper)
- **Estrutura de Roles e `security.json`:** A modelagem de roles (`admin`, `presenter`, `participant`) e permissões está correta.
- **Gaps de Implementação Identificados:**
  1. *Vazamento de Credenciais:* O frontend lia diretamente `fetch('/config/security.json')`, permitindo que qualquer usuário obtivesse senhas e o PIN de admin via DevTools.
  2. *Flash de Conteúdo Não-Autenticado (FOUC):* A Mesa Técnica montava o HTML dos controles e carregava dados da sessão antes da autenticação.
  3. *Métodos de Login Incompletos no Painel:* O modal da Mesa Técnica solicitava apenas PIN, desconsiderando as credenciais de usuário/senha cadastradas no `security.json` e login corporativo.

---

## 3. Fases de Implementação

### 🚀 Fase 1: Limpeza e Consolidação da Tela Inicial (`index.html`) — [CONCLUÍDA]
- [x] Remover o badge `v1.0.0` do cabeçalho de `index.html`.
- [x] Remover o botão duplicado `#btn-header-import-zip` e o modal `#modal-import-zip`.
- [x] Destacar o botão de acesso ao **SlideMesh Studio** (`import.html`) como ponto único de criação e importação universal.
- [x] Ajustar textos e traduções no dicionário `js/core/i18n-engine.js`.

### 🚀 Fase 2: Robustez dos Modais da Mesa Técnica (`admin/index.html` e `admin-app.js`) — [CONCLUÍDA]
- [x] Validar e garantir a abertura instantânea de `#history-modal` ao clicar em `#admin-btn-history`.
- [x] Validar e garantir a abertura instantânea de `#admin-analytics-modal` ao clicar em `#admin-btn-analytics`.
- [x] Adicionar atalhos de abertura rápida nos cards de métricas e relatórios.

### 🚀 Fase 3: Backend Gatekeeper e Proteção de Credenciais (`server.py` e `auth-engine.js`) — [CONCLUÍDA]
- [x] **Hardening do `server.py`:**
  - [x] Bloquear acesso HTTP direto ao arquivo `config/security.json` com `403 Forbidden`.
  - [x] Criar endpoint `POST /api/auth/verify-pin` para validação segura de PIN no servidor sem expor o PIN ao cliente.
  - [x] Criar endpoint `POST /api/auth/login` para validação segura de usuário e senha locais.
  - [x] Criar endpoint `GET /api/auth/public-config` que retorna apenas flags públicas de segurança (sem senhas ou PINs).
- [x] **Full Lock Screen na Mesa Técnica (`admin/index.html`):**
  - [x] Implementar cortina opaca que impede a visualização de qualquer controle, slide ou nota confidencial antes da autenticação.
  - [x] Oferecer abas de desbloqueio: **🔑 PIN Rápido** | **👤 Usuário & Senha (Admin/Palestrante)** | **🌐 Google Workspace**.
- [x] **Evolução do `AuthEngine` ([`js/core/auth-engine.js`](file:///home/flashbsb/projetos/SlideMeshLive/js/core/auth-engine.js)):**
  - [x] Integrar com os novos endpoints do backend, mantendo fallback gracioso para modo offline/estático.

### 🚀 Fase 4: Testes Automatizados e Homologação — [CONCLUÍDA]
- [x] Adicionar testes na suíte `scratch/test_suite.py`:
  - [x] Teste de bloqueio HTTP 403 para `GET /config/security.json`.
  - [x] Teste de autenticação via `POST /api/auth/verify-pin` e `POST /api/auth/login`.
  - [x] Teste de entrega de metadados públicos via `GET /api/auth/public-config`.
  - [x] Teste de acionamento de Histórico e Analytics.
- [x] Atualizar a documentação oficial (`README.md` e `README.pt-BR.md`) com o **Princípio 16 (Arquitetura de Segurança, RBAC & Backend Gatekeeper)**.

---

## 4. Matriz de Rastreabilidade

| Requisito | Componente | Arquivos Envolvidos | Status |
|---|---|---|---|
| Limpeza de Versão e Importação Única | Portal Inicial | `index.html`, `js/core/i18n-engine.js` | Concluído (Commit `148e086`) |
| Modais de Histórico e Analytics | Mesa Técnica | `admin/index.html`, `js/admin/admin-app.js` | Concluído (Commit `214a30d`) |
| Bloqueio de Acesso a Credenciais (403) | Backend HTTP | `server.py` | Concluído (Commit `4bcca7f`) |
| Endpoints Seguros de Autenticação | Backend API | `server.py`, `js/core/auth-engine.js` | Concluído (Commit `4bcca7f`) |
| Full Lock Screen e Multi-Auth | Frontend Admin | `admin/index.html`, `js/admin/admin-app.js` | Concluído (Commit `4bcca7f`) |
| Suíte de Testes e Homologação | Testes & Docs | `scratch/test_suite.py`, `README.md`, `README.pt-BR.md` | Concluído (Commit `4bcca7f`) |

