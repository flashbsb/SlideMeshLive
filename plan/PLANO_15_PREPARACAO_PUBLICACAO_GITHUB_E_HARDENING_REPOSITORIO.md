# PLANO 15: PREPARAÇÃO PARA PUBLICAÇÃO NO GITHUB, HARDENING DE REPOSITÓRIO & GOVERNANÇA OPEN-SOURCE

## 1. Visão Geral e Contexto

O **SlideMeshLive** atingiu maturidade arquitetural e funcional completa com as entregas de transições de palco, controle de mídia HTTP 206, portabilidade ZIP (.slidemesh.zip), assistente de primeiro uso (Setup Wizard), painel RBAC de segurança na Mesa Técnica e suporte multissessão.

Antes de tornar o repositório público ou publicá-lo oficialmente no GitHub, é fundamental realizar uma **auditoria de higienização, segurança e governança de código**, assegurando que:
1. Nenhuma credencial real, segredo, arquivo de log, dado de telemetria de teste ou arquivo temporário de sistema operacional seja versionado ou exposto.
2. O arquivo `.gitignore` cubra com precisão cirúrgica todas as extensões, diretórios e casos de borda multiplataforma (Linux, macOS, Windows, IDEs, Python, Node.js).
3. A suíte de testes seja formalizada em um diretório padrão rastreável (`tests/`) em vez de rascunhos (`scratch/`), eliminando a necessidade de flags forçadas (`git add -f`).
4. O repositório contenha todos os arquivos essenciais de governança open-source (`LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `.editorconfig` e pipeline `.github/workflows/ci.yml`).

---

## 2. Diagnóstico Atual do Repositório

| Área | Situação Atual | Risco / Problema | Solução Proposta no Plano 15 |
|---|---|---|---|
| **`.gitignore`** | Possui regras básicas, mas não ignora arquivos gerados em `sessions_archive/*.json` nem arquivos de staging de configuração (`*.tmp`, `.security.json.tmp`). | Arquivos de telemetria analítica de eventos reais ou testes podem ser versionados por engano. | Refatorar `.gitignore` com seções claras, preservando a pasta `sessions_archive/.gitkeep` mas ignorando todos os JSONs gerados. |
| **Organização de Testes** | A suíte de testes principal está em `scratch/test_suite.py`, mas a pasta `scratch/` está no `.gitignore`, exigindo `git add -f`. | Risco de esquecer de commitar testes ou de commitar arquivos de rascunho acidentalmente com `-f`. | Mover a suíte para `tests/test_suite.py` devidamente rastreada e manter `scratch/` estritamente para scripts descartáveis do operador. |
| **Governança & Licença** | Não há arquivo `LICENSE`, `SECURITY.md` ou `CONTRIBUTING.md`. | Ambiguidade jurídica quanto aos direitos de uso, falta de canal para reporte de vulnerabilidades e ausência de guia para contribuidores. | Adicionar licença MIT explícita, política de segurança estruturada e manual de contribuição. |
| **CI/CD Automatizado** | Não há workflows de GitHub Actions configurados em `.github/workflows/`. | Impossibilidade de verificar regressões automaticamente nos Pull Requests e pushes no GitHub. | Criar `.github/workflows/ci.yml` executando a suíte de testes em múltiplas versões de Python (3.9 a 3.12). |
| **Padronização de Código** | Ausência de `.editorconfig`. | Conflitos de formatação, espaços vs tabs e quebras de linha (`CRLF` vs `LF`) entre desenvolvedores em Windows e Linux. | Criar `.editorconfig` com padrão UTF-8, LF e indentação consistente (2 espaços para web/JSON e 4 para Python). |

---

## 3. Fases de Implementação

### 🚀 Fase 1: Hardening e Refinamento Completo do `.gitignore` — [CONCLUÍDA]
- [x] **Blindagem de Arquivos Sensíveis & Segredos:**
  - [x] Bloqueio estrito de `config/security.json`, `config/security.local.json`, `config/*.tmp`, `config/.*.tmp`, `.env*` e chaves privadas.
  - [x] Inclusão explícita de `!config/security.example.json` e `!config/security.default.json`.
- [x] **Blindagem de Dados Analíticos & Telemetria em Tempo Real:**
  - [x] Bloqueio de `sessions_archive/*.json` com preservação da pasta via `sessions_archive/.gitkeep`.
  - [x] Bloqueio de exportações avulsas (`*.slidemesh.zip`, `export_*.json`, `relatorio_*.csv`, etc.).
- [x] **Blindagem de Caches e Cargas Operacionais:**
  - [x] Python: `__pycache__/`, `*.py[cod]`, `.pytest_cache/`, `.coverage`, `htmlcov/`, `.tox/`, `venv/`, `.venv/`.
  - [x] Node/Web: `node_modules/`, `dist/`, `build/`, `*.log`.
  - [x] SO & IDEs: `.DS_Store`, `Thumbs.db`, `Desktop.ini`, `.idea/`, `.vscode/*`.

### 🚀 Fase 2: Estruturação do Diretório Oficial de Testes (`tests/`) — [CONCLUÍDA]
- [x] **Migração da Suíte de Testes:**
  - [x] Mover `scratch/test_suite.py` para `tests/test_suite.py` e criar wrapper de compatibilidade em `scratch/test_suite.py`.
  - [x] Atualizar script de testes no `package.json` (`"test": "python3 tests/test_suite.py"`).
- [x] **Limpeza de Índices no Git:**
  - [x] Remover referências antigas de arquivos deletados com `git rm` (`slidemesh-showcase-copia/` e `sessions_archive/_________ETC_TEST_MALICIOUS_analytics.json`).

### 🚀 Fase 3: Padronização de Governança Open-Source (Arquivos de Raiz) — [CONCLUÍDA]
- [x] **Licenciamento (`LICENSE`):**
  - [x] Adicionar a licença MIT padrão aberta com atribuição correta.
- [x] **Política de Segurança (`SECURITY.md`):**
  - [x] Definir versões suportadas e orientações sobre como relatar falhas de segurança responsavelmente sem exposição pública prévia.
- [x] **Guia de Contribuição (`CONTRIBUTING.md`):**
  - [x] Instruções claras de setup local, padrão de commits semânticos, execução da suíte de testes e fluxo de Pull Requests.
- [x] **Padronização de Editor (`.editorconfig`):**
  - [x] Configuração de encoding `utf-8`, quebra de linha `lf`, remoção de espaços em branco no final de linhas (`trim_trailing_whitespace = true`), indentação de 2 espaços para HTML/CSS/JS/JSON/Markdown/YAML e 4 espaços para Python.

### 🚀 Fase 4: Automação de Integração Contínua (GitHub Actions CI)
- [ ] **Criação do Workflow (`.github/workflows/ci.yml`):**
  - Trigger em `push` e `pull_request` nos branches `main` e `develop`.
  - Matriz de testes em ambientes Linux Ubuntu com Python 3.9, 3.10, 3.11 e 3.12.
  - Execução automatizada da suíte de testes unificada (`python3 tests/test_suite.py`).
  - Verificação de integridade de arquivos essenciais e ausência de credenciais expostas.

### 🚀 Fase 5: Homologação Final, Validação de Integridade e Documentação
- [ ] **Execução Completa da Suíte de Testes:**
  - Executar `python3 tests/test_suite.py` e certificar 100% de aprovação de todas as suítes.
- [ ] **Atualização dos Manuais (`README.md` e `README.pt-BR.md`):**
  - Adicionar badges de status do CI, licença MIT e versão.
  - Atualizar referências da suíte de testes para `tests/test_suite.py`.
  - Seção clara sobre como contribuir com o projeto.

---

## 4. Matriz de Arquivos a Serem Criados/Ajustados

| Arquivo | Ação | Responsabilidade |
|---|:---:|---|
| [`.gitignore`](file:///home/flashbsb/projetos/SlideMeshLive/.gitignore) | Modificar | Blindagem de telemetria, zips temporários, arquivos `.tmp` e segredos. |
| [`tests/test_suite.py`](file:///home/flashbsb/projetos/SlideMeshLive/tests/test_suite.py) | Criar / Mover | Localização oficial e rastreada da suíte unificada de testes. |
| [`sessions_archive/.gitkeep`](file:///home/flashbsb/projetos/SlideMeshLive/sessions_archive/.gitkeep) | Criar | Manter a pasta de histórico no repositório sem versionar dados reais. |
| [`LICENSE`](file:///home/flashbsb/projetos/SlideMeshLive/LICENSE) | Criar | Licença aberta MIT oficial. |
| [`SECURITY.md`](file:///home/flashbsb/projetos/SlideMeshLive/SECURITY.md) | Criar | Política de reporte e segurança do repositório. |
| [`CONTRIBUTING.md`](file:///home/flashbsb/projetos/SlideMeshLive/CONTRIBUTING.md) | Criar | Guia de boas práticas e contribuição. |
| [`.editorconfig`](file:///home/flashbsb/projetos/SlideMeshLive/.editorconfig) | Criar | Padronização de formatação entre diferentes SOs e IDEs. |
| [`.github/workflows/ci.yml`](file:///home/flashbsb/projetos/SlideMeshLive/.github/workflows/ci.yml) | Criar | Pipeline de automação de testes no GitHub Actions. |
| [`package.json`](file:///home/flashbsb/projetos/SlideMeshLive/package.json) | Modificar | Script `"test": "python3 tests/test_suite.py"`. |
| [`README.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.md) & [`README.pt-BR.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.pt-BR.md) | Modificar | Badges de CI, licença e guia de contribuição. |
