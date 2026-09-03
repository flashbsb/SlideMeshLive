# PLANO MESTRE DE ANÁLISE SISTÊMICA, GOVERNANÇA E IMPLANTAÇÃO FASEADA (VERSÃO 4)
## SlideMeshLive — Plataforma de Apresentação HTML Interativa Sincronizada

> **Documento Mestre de Governança Técnica, Arquitetura, Diagnóstico e Controle de Regressão**  
> **Versão:** 4.0.0 — Data: 03/09/2026  
> **Referência Metodológica:** Protocolo Anti-Regressão `plan/plano_de_implatancao_v2.md`  
> **Status:** 🎯 ANÁLISE SISTÊMICA v4 CONCLUÍDA — 36/36 SUÍTES AUTOMATIZADAS HOMOLOGADAS (100% SUCESSO)  
> **Princípio Central:** *ENTENDER → DOCUMENTAR → PLANEJAR → VALIDAR → IMPLEMENTAR → TESTAR → CONSOLIDAR*

---

## 1. OBJETIVO GERAL & ESCOPO DA VERSÃO 4

O objetivo deste **Plano Mestre v4** é consolidar formalmente a arquitetura completa e o estado real do **SlideMeshLive v1.3.0+**, estabelecendo-se como a **Fonte Única da Verdade (Single Source of Truth)** do projeto para manutenção, auditoria e novas implementações.

Esta versão consolida a conclusão de todos os **17 Planos de Engenharia**, a homologação incondicional dos **36 Módulos de Testes Automatizados** em `tests/test_suite.py`, a implementação da **Matriz de Governança Multi-Auth** em todas as 5 interfaces do ecossistema, o hardening contra ataques em redes locais e o suporte nativo a operações de alta resiliência offline.

### Metas Estratégicas Atingidas:
1. **Rastreabilidade e Integridade Documental Total:** Mapeamento integral de todos os planos, decisões de arquitetura (ADRs) e fluxos de dados do sistema.
2. **Garantia Inegociável de Não-Regressão:** Proteção de todos os princípios de negócio contra efeitos colaterais através de gates de teste automatizados de 12 segundos.
3. **Governança Multi-Auth Centralizada & Server-Side:** Blindagem total contra vazamento de credenciais (PINs expurgados de manifestos públicos, validação 100% backend, regras anti-lockout e RBAC).
4. **Portabilidade Universal & Segurança de Pacotes:** Importação/exportação 1-clique de apresentações em pacotes `.slidemesh.zip` com proteção contra Zip Slip e Zip Bomb.
5. **Operação 100% Offline e Segura em LAN:** Suporte a redes Wi-Fi locais com rate-limiting anti-flooding, sanitização anti-XSS e flags CLI para TLS/HTTPS nativo.

---

## 2. AUDITORIA & STATUS REAL DE TODOS OS PLANOS NA PASTA `plan/`

Todos os planos de implementação contidos no repositório foram inspecionados e correlacionados com o código-fonte ativo:

| Arquivo de Plano | Escopo / Funcionalidades | Status Real no Código | Teste / Cobertura |
|---|---|---|---|
| [`PLANO_01_TRANSICOES_E_ANIMACOES_TELAO.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_01_TRANSICOES_E_ANIMACOES_TELAO.md) | Transições cinematográficas GPU (`fade`, `slide`, `zoom`, `dissolve`, `stagger`), seleção no Studio, A11Y WCAG. | ✅ **100% CONCLUÍDO** | Teste 18 (`test_demanda01_stage_transitions_engine`) |
| [`PLANO_02_EFEITOS_E_ANIMACAO_DISPARADOS_MODERADOR.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_02_EFEITOS_E_ANIMACAO_DISPARADOS_MODERADOR.md) | Efeitos de palco em Canvas 2D (`StageFX`), dock na Mesa Técnica com cooldown de 3s, atalhos `C`/`X` no Púlpito. | ✅ **100% CONCLUÍDO** | Teste 19 (`test_demanda02_stage_fx_overlay`) |
| [`PLANO_03_DIAGNOSTICO_PERFORMANCE_E_BANDA_EVENTO.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_03_DIAGNOSTICO_PERFORMANCE_E_BANDA_EVENTO.md) | Endpoint `/api/diagnostics`, Health HUD na Mesa Técnica, compressor client-side Canvas no Studio. | ✅ **100% CONCLUÍDO** | Teste 17 (`test_demanda03_diagnostics_and_capacity_engine`) |
| [`PLANO_09_ANALYTICS_AVANCADO_E_HISTORICO_MULTISESSAO.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_09_ANALYTICS_AVANCADO_E_HISTORICO_MULTISESSAO.md) | Analytics multissessão, telemetria de dwell time, gráficos Canvas 2D, exportação de Relatório Executivo HTML/CSV. | ✅ **100% CONCLUÍDO** | Teste 20 (`test_demanda09_analytics_and_session_archive`) |
| [`PLANO_10_MULTI_SCREEN_PRESENTER_HUB.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_10_MULTI_SCREEN_PRESENTER_HUB.md) | Multi-Screen Presenter Hub, Mural Monumental de Dúvidas, Painel de Enquetes e Dual Display de Palco. | ✅ **100% CONCLUÍDO** | Teste 21 (`test_demanda10_multi_screen_presenter_hub`) |
| [`PLANO_11_OTIMIZADOR_PRE_CACHE_MIDIAS_PESADAS.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_11_OTIMIZADOR_PRE_CACHE_MIDIAS_PESADAS.md) | Streaming HTTP 206 Byte-Range, MediaCacheEngine janela ±2, controle remoto de vídeo/áudio na Mesa Técnica. | ✅ **100% CONCLUÍDO** | Teste 22 (`test_demanda11_media_range_requests`) |
| [`PLANO_12_PORTABILIDADE_IMPORT_EXPORT_ZIP_APRESENTACOES.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_12_PORTABILIDADE_IMPORT_EXPORT_ZIP_APRESENTACOES.md) | Empacotamento `.slidemesh.zip`, export/import 1-clique, hardening Zip Slip e Zip Bomb. | ✅ **100% CONCLUÍDO** | Teste 23 (`test_demanda12_zip_export_import_portability`) |
| [`PLANO_13_SEGURANCA_RBAC_GATEKEEPER_E_MELHORIAS_UX.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_13_SEGURANCA_RBAC_GATEKEEPER_E_MELHORIAS_UX.md) | Proteção de `config/security.json` (`403`), RBAC no Admin, modais de confirmação não-bloqueantes. | ✅ **100% CONCLUÍDO** | Testes 24 e 25 (`test_plano13_portal_and_admin_modals_ux` e `test_plano13_phase3_security_gatekeeper_and_rbac`) |
| [`PLANO_14_SECURITY_SETUP_WIZARD_E_GESTAO_RBAC.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_14_SECURITY_SETUP_WIZARD_E_GESTAO_RBAC.md) | Setup Wizard inicial, painel de segurança 4 abas no Admin, PIN por apresentação no Studio e Lock mobile. | ✅ **100% CONCLUÍDO** | Testes 26, 27, 28 e 29 (`test_plano14_phase1` a `phase4`) |
| [`PLANO_15_PREPARACAO_PUBLICACAO_GITHUB_E_HARDENING_REPOSITORIO.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_15_PREPARACAO_PUBLICACAO_GITHUB_E_HARDENING_REPOSITORIO.md) | Documentação bilíngue README/README.pt-BR, LICENSE MIT, SECURITY.md, padronização de nomenclatura. | ✅ **100% CONCLUÍDO** | Teste 6 (`test_readme_and_documentation_consistency`) |
| [`PLANO_16_SUITE_DE_APRESENTACOES_E_EXEMPLOS_PRATICOS.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_16_SUITE_DE_APRESENTACOES_E_EXEMPLOS_PRATICOS.md) | Autodescoberta dinâmica em disco (`/api/presentations/catalog`), suíte oficial com 7 Manuais Vivos. | ✅ **100% CONCLUÍDO** | Teste 30 (`test_plano16_presentations_auto_discovery_and_catalog_endpoint`) |
| [`PLANO_17_SEGURANCA_GLOBAL_GOVERNANCA_E_PROTECAO_DE_CONTEUDO.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_17_SEGURANCA_GLOBAL_GOVERNANCA_E_PROTECAO_DE_CONTEUDO.md) | Sanitização do manifesto, Gatekeeper de Palco `/presenter/`, bloqueio de ZIP desprotegido, hardening do Studio, anti-spoofing `/api/sync`, HTTPS nativo e Wizard Multi-Auth com anti-lockout. | ✅ **100% CONCLUÍDO** | Testes 31 a 36 (`test_plano17_phase1` a `phase6`) |
| [`PLANO_TRAVA_AVANCO_AUDIENCIA_PACING_LOCK.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_TRAVA_AVANCO_AUDIENCIA_PACING_LOCK.md) | Modos de ritmo da plateia (`lock_future`, `strict_sync`, `free`) e alternância em tempo real. | ✅ **100% CONCLUÍDO** | Teste 16 (`test_audience_pacing_lock_and_controlled_navigation`) |
| [`PLANO_IMPLANTACAO_STUDIO_CRIACAO_E_EDICAO_WEB.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_IMPLANTACAO_STUDIO_CRIACAO_E_EDICAO_WEB.md) | Editor web split-screen em `import.html`, validação de esquema JSON e publicação atômica. | ✅ **100% CONCLUÍDO** | Testes 10 e 11 (`test_presentation_import_endpoint` e `test_slidemesh_studio_web_components`) |
| [`PLANO_IMPLANTACAO_MOTOR_CONVERSAO_PPTX_HTML_PDF.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_IMPLANTACAO_MOTOR_CONVERSAO_PPTX_HTML_PDF.md) | Conversão semântica de arquivos externos (PPTX, DOCX, MD) com templates inteligentes. | ✅ **100% CONCLUÍDO** | Teste 10 (`test_presentation_import_endpoint`) |
| [`PLANO_IMPLANTACAO_APRESENTACAO_SHOWCASE.md`](file:///home/flashbsb/projetos/SlideMeshLive/plan/PLANO_IMPLANTACAO_APRESENTACAO_SHOWCASE.md) | Deck de demonstração oficial cobrindo enquetes, Q&A, mídias e transições. | ✅ **100% CONCLUÍDO** | Teste 1 (`test_catalog_and_presentations_integrity`) |
| `PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` (v1) | Estruturação inicial do projeto. | 🏛️ **HISTÓRICO** | Consolidado na v4 |
| `PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao2.md` (v2) | Moderação estrita e SSE. | 🏛️ **HISTÓRICO** | Consolidado na v4 |
| `PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao3.md` (v3) | Demandas 01, 02 e 03 (Transições, FX, Diagnósticos). | 🏛️ **HISTÓRICO** | Consolidado na v4 |
| `PLANO_MESTRE_NOVAS_DEMANDAS_01_02_03.md` | Detalhamento das Demandas 01 a 03. | 🏛️ **HISTÓRICO** | Consolidado na v4 |

---

## 3. ARQUITETURA SISTÊMICA & AS 5 INTERFACES

O SlideMeshLive é composto por **5 interfaces de usuário especializadas**, suportadas por **Core Engines em Vanilla JavaScript (ESM)** e um **Backend Python assíncrono e sequencial**:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          AS 5 INTERFACES DO ECOSSISTEMA                                     │
├─────────────────┬───────────────────┬───────────────────┬──────────────────────┬────────────────────────────┤
│  1. PORTAL      │ 2. MESA TÉCNICA   │ 3. TELÃO PALCO    │ 4. STUDIO DE AUTORIA │ 5. AUDIÊNCIA MOBILE        │
│  (/index.html)  │ (/admin/)         │ (/presenter/)     │ (/import.html)       │ (/audience/)               │
│                 │                   │                   │                      │                            │
│ • Catálogo Vivo │ • Controle Palco  │ • Projeção 16:9   │ • Editor Split-Screen│ • Sincronização em tempo   │
│ • Modo Intranet │ • Moderação Q&A   │ • Desfoque Notas  │ • Criador de Slides  │   real (<10ms via SSE)     │
│ • Exportar ZIP  │ • Matriz MultiAuth│ • Multi-Screen Hub│ • Exportação ZIP     │ • Trava de Ritmo (Pacing)  │
│ • Docs Viewer   │ • Analytics & FX  │ • Hotkeys de Palco│ • Gatekeeper de PIN  │ • Enquetes & Q&A Seguro    │
└────────┬────────┴─────────┬─────────┴─────────┬─────────┴──────────┬───────────┴─────────────┬──────────────┘
         │                  │                   │                    │                         │
┌────────┴──────────────────┴───────────────────┴────────────────────┴─────────────────────────┴──────────────┐
│                                             CORE ENGINES (ESM)                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • AuthEngine: Gatekeeper Multi-Auth (PIN Mestre/Deck, Contas Locais RBAC, Google SSO Whitelist)            │
│ • PresentationEngine: Renderizador JSON, Transições GPU (Fade, Slide, Zoom, Stagger), Markdown & MathJax    │
│ • RealtimeEngine: Despachante Híbrido (SSE /api/events, Hub HTTP /api/sync, BroadcastChannel Local)        │
│ • StageFXEngine: Efeitos Visuais em Canvas 2D Overlay (Confetes, Shockwave, Spotlight, Countdown, Glitch)   │
│ • InteractionEngine: Voto Único em Enquetes, Pacing Lock Mode (`lock_future`, `strict_sync`, `free`)        │
│ • ModerationEngine: Gate Estrito ADR-04 (Pending ➔ Approved ➔ Featured ➔ Answered) com Anti-XSS Sanitizer   │
│ • MediaCacheEngine: Pré-cache preditivo janela ±2 slides, HTTP 206 Byte-Range streaming e controle remoto   │
│ • AnalyticsEngine: Telemetria de engajamento, Dwell time por slide, exportação de relatórios HTML/CSV       │
│ • SecurityGuard: Rate-limiting (2s), Anti-Flooding, RBAC Action Enforcement, Sanitização de Uploads        │
└──────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                                       │
┌──────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┐
│                                        BACKEND PYTHON (server.py)                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ • ThreadingHTTPServer de Alta Performance com suporte a TLS/HTTPS nativo (`--ssl-cert` e `--ssl-key`)       │
│ • Endpoint SSE `/api/events` com Heartbeat ativo (15s) e reconexão transparente                             │
│ • Hub Sequencial `/api/sync` com RBAC Enforcement (Rejeição `403` para comandos privilegiados sem PIN)       │
│ • Autodescoberta & Catálogo Dinâmico `/api/presentations/catalog` com sanitização estrita de segurança     │
│ • Motor de Importação/Exportação ZIP com mitigação de Zip Slip (traversal path) e Zip Bomb (200MB limit)    │
│ • Persistência Atômica de Estado em Disco (`snapshot_state.json` e `config/security.json`)                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. MATRIZ DE GOVERNANÇA MULTI-AUTH CONSOLIDADA

A segurança é configurada centralmente em `config/security.json` e gerenciada pelo Setup Wizard (`setup.html`) ou pela Mesa Técnica (`admin/index.html`):

### 4.1 Mecanismos de Autenticação Suportados:
1. **🔑 PIN Mestre / PIN do Deck:** Código numérico de 4 a 8 dígitos para operadores, palestrantes e desbloqueio rápido de slides.
2. **👤 Contas Locais RBAC:** Usuário e senha dedicados armazenados no servidor com suporte a papéis `admin` (acesso total) e `presenter` (apenas telão e notas).
3. **🌐 Google Workspace SSO Whitelist:** Validação de domínios ou e-mails corporativos autorizados a moderar ou apresentar.

### 4.2 Matriz de Cobertura por Interface:

| Interface | Rota | Escopo de Proteção (`multiAuth.scopes`) | Comportamento com Deck Protegido / Não Autenticado |
|---|---|---|---|
| **🎛️ Mesa Técnica** | `/admin/` | `admin: true` | Desfoque de tela e bloqueio interativo total via `#admin-lock-modal`. Exige PIN mestre ou login de admin. |
| **🎤 Telão de Palco** | `/presenter/` | `presenter: true` | Desfoque de tela (`.presenter-locked`) e modal `#presenter-auth-modal`. Bloqueia visualização de notas de orador. |
| **🎨 SlideMesh Studio** | `/import.html` | `studio: true` | Bloqueio de carregamento dos slides via `#studio-deck-auth-modal`. Exige validação prévia de PIN. |
| **🏢 Modo Intranet** | `/index.html` | `portal: true` | Bloqueio global do catálogo via `#portal-global-lock-modal` quando o modo Intranet estiver ativo. |
| **📦 Exportação ZIP** | `/api/presentations/export` | `studio: true` | Bloqueio com `401 Unauthorized` para downloads de decks restritos sem o PIN correto no parâmetro `&pin=`. |
| **📱 Audiência Mobile**| `/audience/` | *Por Deck* | Modal de bloqueio de tela por PIN com dica contextual (`pinHint`). Validação 100% server-side via `/api/auth/verify-pin`. |

> **Regra Anti-Lockout:** O sistema proíbe a desativação simultânea de todos os 3 métodos de autenticação no backend (`400 Bad Request`), impedindo que o administrador perca o acesso definitivo ao painel.

---

## 5. MATRIZ DE HOMOLOGAÇÃO DOS 36 TESTES AUTOMATIZADOS

A suíte unificada [`tests/test_suite.py`](file:///home/flashbsb/projetos/SlideMeshLive/tests/test_suite.py) executa **36 suites de testes** de ponta a ponta em **~12 segundos**:

```text
================================================================================
  MÓDULO DE TESTE                                                       STATUS
================================================================================
  01. Integridade do Catálogo e dos 7 Manuais Vivos                     ✅ 100% OK
  02. Presença de Arquivos Essenciais do Repositório                    ✅ 100% OK
  03. Consistência Bilíngue das Traduções i18n (pt-BR / en-US)          ✅ 100% OK
  04. Endpoints de Sincronização do Servidor (/api/sync)                ✅ 100% OK
  05. Lógica do SecurityGuard, Rate Limiting e Limites                  ✅ 100% OK
  06. Consistência da Documentação e Ausência de Termos Legados         ✅ 100% OK
  07. Otimização do Realtime e Sincronização de Autenticação            ✅ 100% OK
  08. Persistência e Resiliência de Snapshot Atômico em Disco           ✅ 100% OK
  09. Haptics Mobile e Acessibilidade Alto Contraste (WCAG AAA)         ✅ 100% OK
  10. Endpoint de Importação e Conversão PPTX/DOCX/MD                   ✅ 100% OK
  11. Web Components e Editor Split-Screen do SlideMesh Studio          ✅ 100% OK
  12. Upvotes de Perguntas e Gate Estrito de Moderação (ADR-04)         ✅ 100% OK
  13. Streaming SSE (/api/events) e Fallback de Polling                 ✅ 100% OK
  14. Hardening do Backend e Limpeza de Sessões Órfãs                   ✅ 100% OK
  15. Exportação de Deck Estático HTML e Modo Impressão/PDF             ✅ 100% OK
  16. Trava de Avanço da Audiência (Audience Pacing Lock)               ✅ 100% OK
  17. Diagnóstico Pré-Voo e Motor de Capacidade Wi-Fi (Demanda 03)      ✅ 100% OK
  18. Motor de Transições de Palco com Aceleração GPU (Demanda 01)      ✅ 100% OK
  19. Camada de Efeitos Visuais de Palco Canvas 2D (Demanda 02)         ✅ 100% OK
  20. Analytics Multissessão e Relatório Executivo (Demanda 09)         ✅ 100% OK
  21. Multi-Screen Presenter Hub & Dual Display (Demanda 10)            ✅ 100% OK
  22. Otimizador de Mídias e Streaming HTTP 206 (Demanda 11)            ✅ 100% OK
  23. Portabilidade, Export/Import ZIP e Anti-Zip Slip (Demanda 12)     ✅ 100% OK
  24. UX do Portal e Modais Não-Bloqueantes (Plano 13 - Fase 1 e 2)     ✅ 100% OK
  25. Gatekeeper de Segurança e RBAC Server-Side (Plano 13 - Fase 3)    ✅ 100% OK
  26. Setup Wizard de Segurança Inicial (Plano 14 - Fase 1)             ✅ 100% OK
  27. Painel de Segurança 4 Abas na Mesa Técnica (Plano 14 - Fase 2)    ✅ 100% OK
  28. Configuração de PIN e Ritmo no Studio (Plano 14 - Fase 3)         ✅ 100% OK
  29. PIN na Audiência Mobile e Badge de Saúde no Admin (Plano 14 - F4) ✅ 100% OK
  30. Autodescoberta de Apresentações & Endpoint Catálogo (Plano 16)    ✅ 100% OK
  31. Sanitização do Manifesto e Validação Server-Side (Plano 17 - F1)  ✅ 100% OK
  32. Gatekeeper Multi-Auth no Telão do Apresentador (Plano 17 - F2)    ✅ 100% OK
  33. Proteção de Ações & Download ZIP no Portal (Plano 17 - F3)        ✅ 100% OK
  34. Hardening do Studio e Governança ZIP (Plano 17 - F4)              ✅ 100% OK
  35. Blindagem Smartphone, Anti-Spoofing & HTTPS (Plano 17 - F5)       ✅ 100% OK
  36. Matriz de Governança Multi-Auth & Setup Wizard (Plano 17 - F6)    ✅ 100% OK
================================================================================
  RESULTADO FINAL: 36/36 TESTES APROVADOS (100% DE CONFORMIDADE)
================================================================================
```

---

## 6. INVENTÁRIO DE RISCOS & VULNERABILIDADES MITIGADAS

| Risco / Vulnerabilidade | Severidade | Como foi Mitigado no Código |
|---|---|---|
| **Vazamento de PIN em JSON Público** | 🔴 Alta | `server.py` intercepta `GET /presentations/<id>/manifest.json` e redige a chave `"pin"` em tempo real. O cliente valida via `POST /api/auth/verify-pin`. |
| **Bypass de Sessão Administrativa** | 🔴 Alta | `isAdminAuthenticated()` agora exige `sessionStorage.getItem('admin_pin_authenticated') === 'true'`. Sessões locais deslogadas forçam `admin-locked`. |
| **Visualização Indevida de Notas de Orador** | 🔴 Alta | `presenter.css` aplica `.presenter-locked` com desfoque de 12px e modal de autenticação antes de renderizar as notas e o slide de decks restritos. |
| **Download Ilegítimo de Apresentação ZIP** | 🟡 Média | Endpoint `/api/presentations/export` exige validação do PIN do deck antes de disparar o download. |
| **Comandos Administrativos Forjados via Wi-Fi** | 🔴 Alta | `/api/sync` exige autorização administrativa (`X-Admin-PIN` ou `X-Session-Auth`) para comandos de controle de sessão, rejeitando invasores com `403 Forbidden`. |
| **Injeção de Scripts (XSS) em Perguntas** | 🔴 Alta | Perguntas recebidas passam por `html.escape()`, limitadas a 280 caracteres e autores a 50 caracteres no servidor. |
| **Flooding de Perguntas por Participantes** | 🟡 Média | Rate-limiting de 1 pergunta a cada 2 segundos por `uid` com resposta `429 Too Many Requests`. |
| **Lockout Total do Administrador** | 🔴 Alta | Validação anti-lockout impede desativar todos os 3 métodos de autenticação simultaneamente. |
| **Ataque de Zip Slip / Zip Bomb** | 🔴 Alta | `server.py` bloqueia extração de caminhos relativos maliciosos (`../`) e limita descompactação a 200MB / 500 arquivos. |

---

## 7. DIRETRIZES METODOLÓGICAS PARA FUTURAS EVOLUÇÕES

Para manter a estabilidade absoluta do projeto, qualquer alteração futura deverá obrigatoriamente seguir o protocolo estabelecido em `plan/plano_de_implatancao_v2.md`:

1. **Gate 1 — Análise e Diagnóstico:** Identificar a causa raiz exata e nunca tratar apenas o sintoma.
2. **Gate 2 — Planejamento com Análise de Impacto:** Responder às 13 perguntas de impacto antes de escrever código.
3. **Gate 3 — Princípio de Mudança Mínima:** Não fazer refatorações oportunistas durante a correção de bugs.
4. **Gate 4 — Verificação e Testes de Regressão:** Executar `python3 tests/test_suite.py` e garantir que todos os 36 testes continuem passando com 100% de sucesso.
5. **Gate 5 — Consolidação e Rollback:** Registrar alterações no `walkthrough.md` e commitar no Git com mensagem semântica.

---

## 8. BACKLOG DE OPORTUNIDADES ESTRATÉGICAS (v1.4.0+)

Estas oportunidades foram mapeadas durante a auditoria geral e podem ser ativadas em futuros planos sob demanda do usuário:

1. **PWA Avançado & Cache de Mídia Offline (Service Workers):**
   - Instalação como aplicativo nativo no smartphone e pré-cache estático de vídeos e imagens pesadas no IndexedDB do navegador.
2. **Mural de Nuvem de Palavras ao Vivo:**
   - Novo componente de interação visual para perguntas de resposta curta, agregando termos frequentes em tempo real.
3. **Empacotamento Desktop Opcional (Tauri / Electron):**
   - Criação de instalador executável (.exe / .dmg / .AppImage) embutindo o runtime Python e o navegador para operadoras de eventos sem necessidade de terminal.

---

> **Certificação Final:** Este documento consolida integralmente a versão 4.0.0 do SlideMeshLive. Todos os 17 Planos foram concluídos, o ecossistema está blindado e a suíte de 36 testes está 100% homologada.
