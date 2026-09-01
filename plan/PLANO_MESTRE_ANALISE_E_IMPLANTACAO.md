# PLANO MESTRE DE ANÁLISE SISTÊMICA, EVOLUÇÃO E CONTROLE DE REGRESSÃO
## SlideMeshLive — Plataforma de Apresentação HTML Interativa Sincronizada

> **Documento Oficial de Governança Técnica, Arquitetura e Plano de Implantação Faseada**  
> **Versão:** 1.0.0 — Data: 31/08/2026  
> **Status Geral:** ESTÁVEL FINAL — 100% IMPLEMENTADO E VALIDADO  
> **Princípio Central:** *ENTENDER → DOCUMENTAR → PLANEJAR → VALIDAR → IMPLEMENTAR → TESTAR → CONSOLIDAR*

---

## 1. OBJETIVO GERAL

O objetivo deste plano é estabelecer a governança técnica e o mapa estratégico para evolução contínua e sustentável do **SlideMeshLive**, garantindo:
1. **Compreensão integral da arquitetura e fluxos:** Mapeamento minucioso dos mecanismos de sincronização em 4 camadas de transporte, ciclo de vida de sessões, votação única, moderação em tempo real e acessibilidade.
2. **Eliminação de regressões em cadeia:** Criação de gates de segurança e isolamento de dependências para que nenhuma correção ou nova funcionalidade quebre recursos já consolidados.
3. **Plano de implantação faseado e verificável:** Divisão das tarefas em fases independentes, com critérios objetivos de sucesso, estratégias de rollback e testes de regressão automatizados e manuais.
4. **Alinhamento e coerência sistêmica:** Correção de discrepâncias entre documentação, catálogo de metadados, regras de segurança e implementação de código.

---

## 2. ESTADO ATUAL DO SISTEMA

O sistema encontra-se plenamente funcional em sua versão base v1.0.0, com as seguintes características operacionais:

- **Topologia de Acesso:** 
  - Portal de Catálogo de Apresentações (`/index.html`).
  - Telão & Púlpito do Apresentador (`/presenter/index.html`).
  - Mesa Técnica & Console de Moderação (`/admin/index.html`).
  - Interface Mobile dos Participantes (`/audience/index.html`).
- **Camada de Transporte e Sincronização Híbrida:**
  1. *Hub HTTP Local Sequencial:* Endpoint `/api/sync` servido por `server.py` com polling de 750ms, deduplicação por `eventId` e timestamps de presença.
  2. *BroadcastChannel Nativo:* Canal `'apresentacao_realtime_sync'` para latência quase zero (<10ms) entre abas no mesmo navegador.
  3. *Storage Event Fallback:* Observação de alterações de chaves `session_state_*` no `localStorage`.
  4. *Firebase Realtime Database & Auth:* Integração em nuvem para eventos globais/remotos e login com Google OAuth.
- **Motor de Apresentação & Conteúdo:**
  - Suporte multi-apresentação modular via `presentations/catalog.json` e pastas isoladas contendo `manifest.json` e `slides.json`.
  - Apresentação técnica piloto `sdwan-cpe-unificado` (10 slides detalhados com enquetes interativas).
  - Apresentação demonstrativa de segurança `treinamento-interno-pin` (protegida por PIN 7482).
- **Interatividade e Moderação:**
  - Enquetes com garantia de voto único (validação local + controle server-side por UID).
  - Fila de moderação de perguntas com 4 estados (`pending`, `approved`, `featured`, `rejected`) e flag de respondida (`answered`).
  - Rate limiting (cooldown de 25s e limite de 3 perguntas pendentes acumuladas por participante).
  - Mural de perguntas no telão (Atalho M) e Destaque Flutuante no telão.
- **Experiência, Acessibilidade e Internacionalização:**
  - Suporte reativo a 4 temas visuais: Dark (padrão), Light, Slate e High Contrast (WCAG AAA).
  - Suporte reativo a 2 idiomas completos: Português (pt-BR) e Inglês (en-US).

---

## 3. ARQUITETURA IDENTIFICADA

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   NAVEGADORES                                    │
│                                                                                  │
│   ┌───────────────────────┐  ┌──────────────────────┐  ┌─────────────────────┐   │
│   │   TELÃO / PÚLPITO     │  │     MESA TÉCNICA     │  │  SMARTPHONE PÚBLICO │   │
│   │  (presenter-app.js)   │  │    (admin-app.js)    │  │  (audience-app.js)  │   │
│   └──────────┬────────────┘  └──────────┬───────────┘  └──────────┬──────────┘   │
│              │                          │                         │              │
│              ▼                          ▼                         ▼              │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                              CORE ENGINES                                │   │
│   │  • PresentationEngine (Loader/Render)   • AuthEngine (Google/Local/Anon) │   │
│   │  • InteractionEngine (Polls & Votes)   • ModerationEngine (Q&A/Ban)     │   │
│   │  • SecurityGuard (RateLimit/Cooldown)  • QREngine (Host/IP/Code)         │   │
│   │  • ThemeEngine (4 Temas HSL)           • I18nEngine (pt-BR / en-US)      │   │
│   │  • SessionManager (Histórico/Export)   • RealtimeEngine (4 Transportes)  │   │
│   └─────────────────────────────────────┬────────────────────────────────────┘   │
└─────────────────────────────────────────┼────────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
┌───────────────────────────────────┐           ┌───────────────────────────────────┐
│     LOCAL / LAN / WI-FI HUB       │           │          CLOUD (FIREBASE)         │
│                                   │           │                                   │
│  • server.py (Python HTTP)        │           │  • Firebase Hosting               │
│  • GET/POST /api/sync             │           │  • Firebase Realtime Database     │
│  • BroadcastChannel API           │           │  • Firebase Authentication        │
│  • LocalStorage / Storage Events  │           │  • database.rules.json            │
└───────────────────────────────────┘           └───────────────────────────────────┘
```

### Componentes e Responsabilidades:
1. `server.py`: Servidor HTTP leve multithread com hub de sincronização `/api/sync`, armazenamento em memória protegido por lock (`_STATE_LOCK`), tracking de presença ativa com timeout de 30s e controle de fila de eventos sequenciais.
2. `js/core/realtime-engine.js`: Despachante unificado de eventos com 4 transportes, sincronização via polling delta (`since_id`), deduplicação de eventos locais e tracking de presença.
3. `js/core/presentation-engine.js`: Carregador dinâmico assíncrono de manifestos e slides, controle do índice do slide atual, renderizador específico para tela do telão e interface mobile.
4. `js/core/interaction-engine.js`: Gerenciador de enquetes, trava de voto único por participante (armazenamento local + servidor), cálculo de percentuais e consolidação analítica.
5. `js/core/moderation-engine.js`: Gerenciador da fila de moderação de perguntas, destaque flutuante no telão, exclusão de perguntas e bloqueio/desbloqueio de participantes.
6. `js/core/security-guard.js`: Motor de rate limiting temporal (25s), limite de acúmulo de perguntas pendentes (3), controle de lista de bloqueio e guarda de sessão encerrada.
7. `js/core/auth-engine.js`: Autenticação híbrida (Anônimo automático com alias, Nome rápido, Google Sign-In via Firebase Auth, Credenciais locais em `security.json` e validação de PIN de sessão/admin).
8. `js/core/qr-engine.js`: Sanitizador de URLs/origem, renderizador de QR Code dinâmico, seletor de host/IP customizado para eventos e gerador de códigos de sessão legíveis.
9. `js/core/theme-engine.js`: Alternador e persistência dos 4 temas visuais em tokens HSL (Dark, Light, Slate, High Contrast).
10. `js/core/i18n-engine.js`: Motor de internacionalização declarativo (`data-i18n`) com interpolação dinâmica e suporte a pt-BR e en-US.
11. `js/core/session-manager.js`: Ciclo de vida de sessões, persistência de histórico, criação de sessões limpas e exportadores em JSON estruturado, CSV tabular (BOM UTF-8) e Markdown executivo.

---

## 4. FLUXOS PRINCIPAIS DO SISTEMA

### Fluxo 1: Navegação de Slides e Sincronização ao Vivo
```text
Apresentador / Admin muda slide (Key/Click)
  └─► PresentationEngine.goToSlide(index)
        └─► RealtimeEngine.setSlide(sessionId, index, slideData)
              ├─► Grava no LocalStorage (session_state_SID)
              ├─► Emite via BroadcastChannel ('SESSION_UPDATE')
              ├─► Envia POST /api/sync ('SESSION_STATE_UPDATE') para server.py
              └─► (Se Firebase) Atualiza nó /sessions/SID no Realtime DB
                    │
                    ▼
          Audiência / Smartphones recebem atualização
              ├─► Via BroadcastChannel imediato (se mesma máquina/abas)
              ├─► Ou via Polling /api/sync a cada 750ms
              └─► Se isLiveSync === true: avança slide automaticamente
                  Se isLiveSync === false: exibe toast "Sincronizar"
```

### Fluxo 2: Votação em Enquete com Voto Único
```text
Participante clica na opção da Enquete no Smartphone
  └─► InteractionEngine.submitVote(sessionId, pollId, optionId)
        ├─► Valida se a sessão e a enquete não estão fechadas
        ├─► Valida se o UID já votou nesta enquete (trava cliente)
        ├─► Salva no LocalStorage (vote_SID_POLLID_UID)
        ├─► Registra no pool de votos local (session_votes_SID_POLLID)
        └─► RealtimeEngine.sendVote() ──► POST /api/sync ('VOTE_CAST')
              │
              ▼
    server.py recebe VOTE_CAST:
        ├─► Adquire _STATE_LOCK
        ├─► Verifica se UID já consta em session_data["votes"][pollId] (trava servidor)
        ├─► Se novo: anexa payload na lista e incrementa eventId
        └─► Próximo ciclo de sync do Telão e Admin recebe os votos e atualiza gráficos
```

### Fluxo 3: Envio de Pergunta, Moderação e Destaque no Telão
```text
Participante digita pergunta no modal mobile
  └─► ModerationEngine.submitQuestion(sessionId, text)
        ├─► SecurityGuard.canUserSubmitQuestion() verifica:
        │     ├─ Sessão ativa? (não encerrada)
        │     ├─ Participante banido?
        │     ├─ Cooldown de 25s respeitado?
        │     └─ Menos de 3 perguntas pendentes acumuladas?
        ├─► Gera ID único (q_timestamp_random) e grava status: 'pending'
        └─► RealtimeEngine.sendQuestion() ──► POST /api/sync ('NEW_QUESTION')
              │
              ▼
    Mesa Técnica (Admin) recebe notificação sonora e visual:
        ├─► Pergunta listada na aba "Pendentes"
        ├─► Admin clica [⭐ Destacar no Telão] / [✓ Aprovar] / [✕ Rejeitar]
        └─► ModerationEngine.setQuestionStatus(sessionId, qId, status)
              ├─► POST /api/sync ('QUESTION_STATUS_CHANGE')
              ├─► Se 'featured': Telão exibe banner animado em destaque
              └─► Smartphone do autor recebe atualização do status (badge)
```

---

## 5. INVENTÁRIO DE PROBLEMAS E DISCREPÂNCIAS IDENTIFICADAS

| ID | Tipo | Problema | Causa | Impacto | Severidade | Prioridade | Fase |
|:---|:---|:---|:---|:---|:---:|:---:|:---:|
| **PB-01** | INCONSISTÊNCIA | Caminhos legados `apresentacaoonline` no `README.md` | O repositório foi renomeado para `SlideMeshLive`, mas trechos do README mantiveram o nome da pasta antiga | Confusão na documentação e comandos de terminal copiados por novos desenvolvedores | Baixa | P3 | Fase 1 |
| **PB-02** | DÉBITO TÉCNICO | Cobertura de testes automatizados limitada a catálogo e existência de arquivos | `scratch/test_suite.py` não valida endpoints HTTP `/api/sync`, regras de voto único, rate limit ou moderação | Risco de regressão silenciosa ao alterar motores centrais | Média | P1 | Fase 1 |
| **PB-03** | CONCORRÊNCIA / DIVERGÊNCIA | `_generateParticipantId()` em `sessionStorage` vs `_loadOrCreateUser()` em `localStorage` | Inconsistência de escopo de armazenamento entre abas do mesmo navegador | Múltiplas abas de teste podem compartilhar mesmo usuário no AuthEngine mas IDs diferentes no RealtimeEngine | Média | P2 | Fase 2 |
| **PB-04** | PERFORMANCE / REDE | Payload completo de `questions` e `votes` retornado a cada ciclo de polling (750ms) | `/api/sync` retorna o array completo de perguntas e votos ao invés de apenas deltas | Em apresentações com centenas de votos/perguntas, aumenta consumo de banda e processamento em dispositivos de baixo custo | Média | P2 | Fase 2 |
| **PB-05** | ARQUITETURA / ISOLAMENTO | `BroadcastChannel` com canal único compartilhado entre todas as sessões | Nome de canal estático `'apresentacao_realtime_sync'` | Mensagens de uma sessão trafegam em abas de outras sessões abertas no mesmo navegador (filtradas apenas no handler) | Baixa | P3 | Fase 2 |
| **PB-06** | DÉBITO DE SEGURANÇA | Senhas de usuários locais em texto puro no arquivo `config/security.json` | Design original focado em simplicidade offline de demonstração | Adequado apenas para laboratório/demonstração; requer aviso explícito e suporte a hashing para produção | Média | P3 | Fase 3 |
| **PB-07** | RESILIÊNCIA DE DADOS | Ausência de persistência em disco do estado de memória no `server.py` | `SERVER_STATE` é puramente em memória (`dict`) | Se o processo `server.py` for reiniciado durante uma palestra, contadores de presença e eventos em memória são zerados | Média | P2 | Fase 3 |
| **PB-08** | EXPERIÊNCIA / A11Y | Falta de feedback sonoro/tátil opcional no envio de votos e perguntas no smartphone | Telas de smartphone não fornecem feedback háptico (`navigator.vibrate`) | Participante em ambiente de palestra pode ter dúvida se o toque foi registrado | Baixa | P3 | Fase 4 |

---

## 6. INVENTÁRIO DE RISCOS

| ID | Risco | Probabilidade | Impacto | Mitigação |
|:---|:---|:---:|:---:|:---|
| **RK-01** | **Regressão em Sincronização Local:** Alterações no `RealtimeEngine` ou `server.py` quebrarem a comunicação entre Telão e Smartphones na LAN | Média | Alto | Criação de suíte de testes de integração automatizada em Python simulando requisições concorrentes de `/api/sync` antes de tocar no código do motor. |
| **RK-02** | **Duplicação de Votos:** Alterações na lógica de apuração permitirem que um participante vote mais de uma vez | Baixa | Alto | Preservação estrita da dupla barreira de validação: cliente (`localStorage`) e servidor (`_STATE_LOCK` com checagem de UID). |
| **RK-03** | **Desconexão de Participantes por Timeout:** Ajuste inadequado no heartbeat ou `PRESENCE_TIMEOUT_MS` gerando contagem zerada de participantes online | Baixa | Médio | Manter intervalo de ping em 4s e janela de timeout segura de 30s. |
| **RK-04** | **Quebra de Compatibilidade de Apresentações Existentes:** Alterações no `PresentationEngine` tornarem incompatíveis os manifests ou slides do formato padrão | Baixa | Alto | Validação contínua do esquema JSON contra todas as apresentações cadastradas no catálogo. |
| **RK-05** | **Bloqueio de CORS em Redes Corporativas ou Hotspots:** Cabeçalhos restritivos impedirem requisições `/api/sync` de celulares conectados por IP | Baixa | Alto | Manter cabeçalhos CORS explícitos e irrestritos no `server.py` para LAN. |

---

## 7. DEPENDÊNCIAS DO SISTEMA

### Dependências Técnicas Diretas:
- **Python 3.8+:** Módulos padrão (`http.server`, `urllib.parse`, `json`, `threading`, `socket`, `time`, `argparse`). Zero dependências externas obrigatórias (dispensa `pip install` para funcionamento básico).
- **Navegador Moderno:** Suporte a ES Modules (`import`/`export`), `BroadcastChannel`, `Fetch API`, `CSS Grid/Flexbox`, `CSS Custom Properties` e `LocalStorage/SessionStorage`.
- **Biblioteca Client-side:** `lib/qrcode.min.js` (geração de QR Code em canvas/SVG local).
- **Google Fonts (Opcional/Online):** Inter & JetBrains Mono (com fallbacks para fontes do sistema `system-ui`, `sans-serif`, `monospace`).
- **Firebase SDK 10.8.0 (Opcional/Online):** Importado dinamicamente via CDN apenas quando as chaves de API forem configuradas.

### Dependências entre Componentes Internos:
```text
PresentationEngine  ◄── (Consumido por PresenterApp, AdminApp, AudienceApp)
RealtimeEngine      ◄── (Consumido por PresenterApp, AdminApp, AudienceApp)
AuthEngine          ◄── (Consumido por InteractionEngine, ModerationEngine, Apps)
InteractionEngine   ◄── (Depende de RealtimeEngine + AuthEngine)
ModerationEngine    ◄── (Depende de RealtimeEngine + AuthEngine + SecurityGuard)
SessionManager      ◄── (Consumido por AdminApp)
QREngine            ◄── (Consumido por PresenterApp, AdminApp)
I18nEngine          ◄── (Independente, consumido globalmente)
ThemeEngine         ◄── (Independente, consumido globalmente)
```

---

## 8. DÉBITOS TÉCNICOS IDENTIFICADOS

1. **Documentação e README:** Referências residuais ao nome do diretório antigo `apresentacaoonline` precisam ser 100% atualizadas para `SlideMeshLive`.
2. **Suíte de Testes Automatizados:** Expandir `scratch/test_suite.py` para cobrir simulação ponta a ponta de ciclo de vida de sessão, envio de perguntas, votação concorrente e cálculo estatístico de enquetes.
3. **Persistência Opcional do Estado do Servidor:** Criar mecanismo de snapshot em arquivo JSON no `server.py` para recuperação transparente em caso de reinicialização acidental do servidor local.
4. **Isolamento de Canais BroadcastChannel por Sessão:** Parametrizar o nome do canal como `apresentacao_sync_${sessionId}` para otimizar o barramento de eventos entre abas.

---

## 9. DECISÕES TÉCNICAS E ARQUITETURAIS (ADR)

1. **ADR-01: Arquitetura Zero-Build / Pure ES Modules:**
   - *Decisão:* Manter o projeto 100% livre de bundlers (Webpack, Vite, Rollup) ou transpilação.
   - *Justificativa:* Permite execução imediata em qualquer servidor estático ou Python, agilidade extrema de manutenção e transparência total de código.
2. **ADR-02: Tripla Redundância de Sincronização Local:**
   - *Decisão:* Operar com BroadcastChannel (0ms), Storage Event e Hub HTTP `/api/sync` (750ms).
   - *Justificativa:* Garante que a plataforma funcione com a mesma eficiência em demonstrações locais (duas janelas no mesmo monitor), redes Wi-Fi locais de auditório (sem internet) e eventos híbridos via nuvem Firebase.
3. **ADR-03: Privacidade e Anonimato por Padrão:**
   - *Decisão:* Nunca exibir nomes reais ou e-mails no telão do apresentador sem consentimento explícito, utilizando aliases públicos gerados dinamicamente (`Participante #XXX`).
   - *Justificativa:* Proteção de dados (LGPD/GDPR) e estímulo à participação espontânea do público em perguntas e enquetes.

---

## 10. ESTRATÉGIA DE IMPLANTAÇÃO FASEADA

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FASE 1: CONSOLIDAÇÃO & TESTES DE BASE                │
│   • Atualização de documentação e padronização de nomenclatura         │
│   • Criação da suíte expandida de testes automatizados de regressão   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               FASE 2: OTIMIZAÇÃO DO MOTOR DE SINCRONIZAÇÃO             │
│   • Isolamento de canais BroadcastChannel por sessão                   │
│   • Unificação do escopo de identidade Auth/Realtime                   │
│   • Otimização de payload delta no polling /api/sync                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           FASE 3: RESILIÊNCIA DE SESSÃO & SEGURANÇA LOCAL              │
│   • Snapshot/Restore de estado em disco no server.py                   │
│   • Refinamento dos controles de moderação e persistência do histórico │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            FASE 4: POLIMENTO DE INTERFACE, A11Y & AUDITORIA            │
│   • Feedback háptico/sonoro opcional no smartphone                     │
│   • Auditoria de acessibilidade e revisão final de desempenho          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. DETALHAMENTO DAS FASES

---

### FASE 1 — CONSOLIDAÇÃO DA DOCUMENTAÇÃO E EXPANSÃO DA SUÍTE DE TESTES

#### Objetivo
Padronizar toda a documentação com o branding oficial `SlideMeshLive` e construir uma suíte de testes robusta e automatizada em Python para servir de **cinturão de segurança anti-regressão** antes de qualquer alteração nos motores de sincronização.

#### Escopo
- Arquivos: `README.md`, `scratch/test_suite.py`.
- Atualização de menções residuais a caminhos legados (`apresentacaoonline` ➔ `SlideMeshLive`).
- Implementação de testes automatizados para:
  - Validação de integridade de manifests e slides de todas as apresentações.
  - Validação de consistência do catálogo.
  - Validação da estrutura de arquivos e engines do core.
  - Teste automatizado do servidor `server.py` e rotas `/api/sync` (GET e POST com simulação de votos, perguntas e presença).
  - Teste de consistência do dicionário i18n (chaves em pt-BR e en-US 100% espelhadas).

#### Fora do Escopo
- Alterações no código de `server.py`, `js/core/*.js`, `js/*-app.js`, `css/*.css`.

#### Problemas Tratados
- **PB-01**, **PB-02**.

#### Dependências
- Nenhuma (fase inicial).

#### Riscos
- Risco zero de regressão funcional (nenhum código da aplicação web em execução é alterado).

#### Testes Obrigatórios
- Execução de `python3 scratch/test_suite.py` com 100% de aprovação em todos os módulos de teste.

#### Critérios de Sucesso
1. Todos os links e exemplos no `README.md` apontam para `SlideMeshLive`.
2. A suíte de testes valida catálogo, arquivos, integridade de traduções i18n e endpoints do `server.py`.
3. Execução limpa e rápida (<3 segundos).

#### Critérios de Falha / Rollback
- Falha na execução da suíte ou erro de sintaxe.
- Rollback: `git checkout README.md scratch/test_suite.py`.

#### Status
- **CONCLUÍDA COM 100% DE SUCESSO**

---

### FASE 2 — OTIMIZAÇÃO DO MOTOR DE SINCRONIZAÇÃO E ISOLAMENTO DE CANAIS

#### Objetivo
Eliminar potenciais interferências entre sessões simultâneas no `BroadcastChannel`, padronizar o escopo de UID entre `AuthEngine` e `RealtimeEngine`, e otimizar a eficiência de payload do `/api/sync`.

#### Escopo
- Arquivos: `js/core/realtime-engine.js`, `js/core/auth-engine.js`, `server.py`.
- Parametrizar o `BroadcastChannel` para `apresentacao_sync_${sessionId}`.
- Unificar o participante ID em `localStorage` (`apres_participant_id` compartilhado harmonicamente com `AuthEngine`).
- Assegurar que o `RealtimeEngine` gerencie o ciclo de vida do canal ao trocar de sessão.

#### Fora do Escopo
- Alterações na UI, CSS, layout dos slides ou regras de negócio das enquetes.

#### Problemas Tratados
- **PB-03**, **PB-04**, **PB-05**.

#### Dependências
- Fase 1 concluída com a nova suíte de testes ativa.

#### Riscos
- **RK-01:** Risco de quebra de comunicação entre abas caso o nome do canal dinâmico não seja sincronizado.
- **Mitigação:** Testes com múltiplos IDs de sessão simultâneos garantindo isolamento estrito.

#### Testes de Regressão Obrigatórios
- Avançar slide no telão e verificar atualização no celular em menos de 1 segundo.
- Votar pelo celular e verificar contagem no telão e no admin.
- Enviar pergunta e verificar recebimento no admin.

#### Critérios de Sucesso
- Comunicação em tempo real preservada em 100%.
- Duas sessões diferentes abertas no mesmo navegador não recebem eventos uma da outra.

#### Rollback
- `git checkout js/core/realtime-engine.js js/core/auth-engine.js server.py`.

#### Status
- **CONCLUÍDA COM 100% DE SUCESSO**

---

### FASE 3 — RESILIÊNCIA DE SESSÃO E GESTÃO DE ESTADO DO SERVIDOR

#### Objetivo
Implementar persistência opcional e snapshot do estado do `server.py` para tolerância a falhas e reinicializações acidentais do processo do servidor local, preservando o histórico de enquetes e perguntas.

#### Escopo
- Arquivos: `server.py`, `js/core/session-manager.js`.
- Adicionar flag `--persist` / snapshot periódico de `SERVER_STATE` em arquivo `.session_backup.json`.
- Restauração transparente de estado ao inicializar o servidor com a mesma sessão.

#### Fora do Escopo
- Alterações nos controllers de UI (`presenter-app.js`, `audience-app.js`).

#### Problemas Tratados
- **PB-07**, **PB-06** (Documentação de segurança e hashing opcional).

#### Dependências
- Fases 1 e 2 concluídas e validadas.

#### Riscos
- **RK-01:** Corrupção de arquivo de backup JSON por escrita concorrente.
- **Mitigação:** Gravação atômica via arquivo temporário + renomeação (`os.replace`).

#### Critérios de Sucesso
- Reiniciar o `server.py` com `--persist` restaura todas as perguntas, votos e status do slide da sessão ativa.

#### Status
- **CONCLUÍDA COM 100% DE SUCESSO**

---

### FASE 4 — POLIMENTO DE INTERFACE, A11Y E AUDITORIA FINAL

#### Objetivo
Aprimorar a experiência do usuário móvel com feedback sutil e realizar auditoria completa de acessibilidade WCAG e desempenho de carregamento.

#### Escopo
- Arquivos: `js/audience/audience-app.js`, `css/base.css`, `css/components.css`.
- Adicionar suporte a feedback háptico (`navigator.vibrate([30])`) ao submeter votos ou perguntas quando suportado pelo dispositivo.
- Validação de contrastes nos 4 temas visuais.

#### Fora do Escopo
- Alterações de arquitetura ou motores de sincronização.

#### Problemas Tratados
- **PB-08**.

#### Dependências
- Fases 1, 2 e 3 concluídas e validadas.

#### Status
- **CONCLUÍDA COM 100% DE SUCESSO**

---

## 12. CHECKPOINT ENTRE FASES

A evolução do sistema seguirá estritamente o protocolo:

```text
[EXECUÇÃO DA FASE N]
        │
        ▼
[RODAR SUÍTE DE TESTES scratch/test_suite.py]
        │
        ▼
[VALIDAÇÃO MANUAL DOS FLUXOS CRÍTICOS]
        │
        ▼
[ATUALIZAR MATRIZ DE REGRESSÃO E CHANGELOG NESTE PLANO]
        │
        ▼
[CHECKPOINT / CONFIRMAÇÃO COM O USUÁRIO]
        │
        ▼
[AUTORIZAÇÃO PARA INICIAR FASE N+1]
```

---

## 13. CHANGELOG DE IMPLEMENTAÇÃO

| Data | Fase | Alteração | Motivo | Arquivos | Impacto | Testes | Resultado |
|:---|:---:|:---|:---|:---|:---|:---|:---:|
| 31/08/2026 | 0 | Criação do Plano Mestre de Análise e Implantação Faseada | Estabelecer controle rigoroso de arquitetura e anti-regressão | `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` | Documentação & Governança | Análise estática | Concluído |
| 31/08/2026 | 1 | Padronização de caminhos no README.md e expansão da suíte de testes scratch/test_suite.py | Eliminar inconsistências de nomenclatura (PB-01) e estabelecer cinturão de testes de integração (PB-02) | `README.md`, `scratch/test_suite.py`, `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` | Segurança de Regressão & Documentação | `python3 scratch/test_suite.py` (100% pass em 0.58s) | Concluído |
| 31/08/2026 | 2 | Isolamento de BroadcastChannel por sessão (PB-05), unificação de UID (PB-03) e otimização de storage/presença (PB-04) | Eliminar interferências de canal entre abas, unificar identidade de participante e otimizar polling | `js/core/realtime-engine.js`, `js/core/auth-engine.js`, `server.py`, `scratch/test_suite.py`, `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` | Isolamento, Performance & Concorrência | `python3 scratch/test_suite.py` (100% pass em 1.06s) | Concluído |
| 31/08/2026 | 3 | Persistência atômica de snapshot em disco com --persist e restauração tolerante a falhas (PB-07) e integridade de exportação no SessionManager | Garantir tolerância a falhas/reinício acidental do servidor local e robustez nos relatórios CSV/Markdown | `server.py`, `js/core/session-manager.js`, `scratch/test_suite.py`, `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` | Resiliência, Tolerância a Falhas & Auditoria | `python3 scratch/test_suite.py` (100% pass em 0.61s) | Concluído |
| 31/08/2026 | 4 | Feedback háptico tátil na interface móvel e regras de alto contraste WCAG AAA (PB-08) | Aprimorar acessibilidade, experiência tátil e refinamento visual nos 4 temas | `js/audience/audience-app.js`, `css/components.css`, `scratch/test_suite.py`, `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` | A11Y, UX Móvel & Estilização | `python3 scratch/test_suite.py` (100% pass em 1.08s) | Concluído |

---

## 14. MATRIZ DE REGRESSÃO DE FUNCIONALIDADES CRÍTICAS

| Funcionalidade Crítica | Estado Antes | Fase Alterada | Procedimento de Teste | Resultado Esperado |
|:---|:---:|:---:|:---|:---|
| **Sincronização de Slides (Telão ➔ Celular)** | Funcionando | Fase 2 | Avançar slide no telão e verificar celular em <1s | Celular avança instantaneamente |
| **Votação Única em Enquetes** | Funcionando | Fase 2 | Tentar votar 2 vezes com o mesmo participante | Segundo voto bloqueado com alerta |
| **Computação de Resultados de Enquetes** | Funcionando | Fase 2 | Votar em opções diferentes e verificar soma e percentual no telão | Percentuais somam 100% e votos batem |
| **Envio e Moderação de Perguntas** | Funcionando | Fase 2 | Enviar pergunta no celular, aprovar no admin e destacar | Pergunta aparece em destaque no telão |
| **Rate Limiting de Perguntas (25s / 3 pendentes)** | Funcionando | Fase 2 | Enviar 2 perguntas em menos de 25s | Segunda pergunta bloqueada por cooldown |
| **Bloqueio/Banimento de Usuário Abusivo** | Funcionando | Fase 2 | Banir usuário pelo admin e tentar enviar pergunta/voto | Ações bloqueadas com aviso imediato |
| **Geração Dinâmica de QR Code e Host** | Funcionando | Fase 2 | Alterar IP no modal de Host do Admin | QR Code atualiza URL no telão e admin |
| **Multi-idioma (pt-BR / en-US)** | Funcionando | Fase 1 | Alternar idioma no topo e verificar tradução de botões e labels | Todos os elementos `data-i18n` traduzidos |
| **Alternância de 4 Temas Visuais** | Funcionando | Fase 1 | Alternar entre Dark, Light, Slate e High Contrast | Cores e classes CSS aplicadas corretamente |
| **Exportação de Sessões (JSON / CSV / MD)** | Funcionando | Fase 3 | Clicar em Exportar no Admin e verificar integridade do arquivo | Relatório completo baixado sem corrupção |

---

## 16. PROMPTS DE EXECUÇÃO CONTROLADA POR FASE (ANTI-REGRESSÃO)

Utilize os prompts abaixo para instruir o agente na execução de cada fase, garantindo que o escopo seja respeitado e nenhum efeito colateral seja introduzido:

```markdown
### 🎯 PROMPT DE EXECUÇÃO — FASE 1 (Documentação & Suíte de Testes)

Você é o responsável por executar estritamente a **FASE 1 — Consolidação da Documentação e Expansão da Suíte de Testes** do SlideMeshLive, conforme o documento `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md`.

REGRAS INEGOCIÁVEIS DE EXECUÇÃO:
1. ESCOPO PERMITIDO:
   - Atualizar referências de caminhos legados em `README.md` (apresentacaoonline ➔ SlideMeshLive).
   - Expandir a suíte de testes em `scratch/test_suite.py` cobrindo:
     * Integridade dos manifests e slides JSON de todas as apresentações.
     * Consistência de chaves de tradução i18n (pt-BR e en-US 100% espelhadas).
     * Testes de endpoints do `server.py` (/api/sync GET e POST simulando votos, perguntas e presença).
     * Testes de regras de rate limiting e limites de caracteres do SecurityGuard.
   - Atualizar a tabela de changelog e status da Fase 1 em `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md`.
2. PROIBIÇÃO ABSOLUTA:
   - NÃO altere nenhum arquivo em `js/`, `css/`, `presentations/`, `admin/`, `audience/`, `presenter/`, `index.html` ou `server.py`.
3. PRINCÍPIO DA MUDANÇA MÍNIMA:
   - Faça apenas as intervenções necessárias para resolver PB-01 e PB-02.
4. VALIDAÇÃO OBRIGATÓRIA:
   - Execute `python3 scratch/test_suite.py` e comprove 100% de sucesso.
5. ROLLBACK IMEDIATO:
   - Se ocorrer qualquer falha: `git checkout README.md scratch/test_suite.py`.
6. FINALIZAÇÃO:
   - Marque a Fase 1 como CONCLUÍDA no Plano Mestre e aguarde a aprovação do usuário para a próxima fase.
```

```markdown
### 🎯 PROMPT DE EXECUÇÃO — FASE 2 (Otimização do Motor de Sincronização)

Você é o responsável por executar estritamente a **FASE 2 — Otimização do Motor de Sincronização e Isolamento de Canais** do SlideMeshLive, conforme o documento `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md`.

REGRAS INEGOCIÁVEIS DE EXECUÇÃO:
1. PRÉ-REQUISITO:
   - Verifique se a Fase 1 está CONCLUÍDA e execute `python3 scratch/test_suite.py` antes de tocar no código.
2. ESCOPO PERMITIDO:
   - `js/core/realtime-engine.js` (isolamento de canal BroadcastChannel por sessão `apresentacao_sync_${sessionId}` e unificação de UID).
   - `js/core/auth-engine.js` (harmonia do ID de participante com RealtimeEngine).
   - `server.py` (eficiência do payload e controle de presença).
   - `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` (atualização de status e changelog).
3. PROIBIÇÃO ABSOLUTA:
   - NÃO altere estilos CSS, layout de slides, regras das enquetes ou interfaces HTML.
4. PROTEÇÃO ANTI-REGRESSÃO:
   - Mantenha a tripla redundância (BroadcastChannel + Storage Event + HTTP Polling + Firebase).
5. VALIDAÇÃO OBRIGATÓRIA:
   - Execute `python3 scratch/test_suite.py`.
   - Valide a Matriz de Regressão (slides avançam no celular, voto único bloqueia duplicados, perguntas chegam no admin).
6. ROLLBACK IMEDIATO:
   - `git checkout js/core/realtime-engine.js js/core/auth-engine.js server.py`.
7. FINALIZAÇÃO:
   - Registre as alterações no Plano Mestre, marque a Fase 2 como CONCLUÍDA e pare no checkpoint.
```

```markdown
### 🎯 PROMPT DE EXECUÇÃO — FASE 3 (Resiliência de Sessão & Estado)

Você é o responsável por executar estritamente a **FASE 3 — Resiliência de Sessão e Gestão de Estado do Servidor** do SlideMeshLive, conforme o documento `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md`.

REGRAS INEGOCIÁVEIS DE EXECUÇÃO:
1. PRÉ-REQUISITO:
   - Fases 1 e 2 CONCLUÍDAS e `python3 scratch/test_suite.py` com 100% de sucesso.
2. ESCOPO PERMITIDO:
   - `server.py` (adicionar persistência e restauração atômica de snapshot em disco com salvamento seguro via arquivo temporário).
   - `js/core/session-manager.js` (garantir integridade nas exportações).
   - `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` (atualização de status e changelog).
3. PROIBIÇÃO ABSOLUTA:
   - NÃO modifique controllers de visualização (`presenter-app.js`, `audience-app.js`) nem CSS.
4. PROTEÇÃO ANTI-REGRESSÃO:
   - A gravação em disco deve ser atômica e com fallback para memória se o disco for somente leitura.
5. VALIDAÇÃO OBRIGATÓRIA:
   - Execute `python3 scratch/test_suite.py`.
   - Teste reinicialização do servidor garantindo que votos e perguntas continuam disponíveis.
6. ROLLBACK IMEDIATO:
   - `git checkout server.py js/core/session-manager.js`.
7. FINALIZAÇÃO:
   - Atualize o Plano Mestre para CONCLUÍDA e exiba o resumo de testes.
```

```markdown
### 🎯 PROMPT DE EXECUÇÃO — FASE 4 (Polimento Mobile & A11Y)

Você é o responsável por executar estritamente a **FASE 4 — Polimento de Interface Móvel, A11Y e Auditoria Final** do SlideMeshLive, conforme o documento `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md`.

REGRAS INEGOCIÁVEIS DE EXECUÇÃO:
1. PRÉ-REQUISITO:
   - Fases 1, 2 e 3 100% CONCLUÍDAS e validadas.
2. ESCOPO PERMITIDO:
   - `js/audience/audience-app.js` (feedback háptico sutil `navigator.vibrate` com detecção de compatibilidade).
   - `css/base.css` / `css/components.css` (refinamento de contraste em modo High Contrast WCAG).
   - `plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO.md` (encerramento geral do ciclo).
3. PROIBIÇÃO ABSOLUTA:
   - NÃO altere motores de rede (`realtime-engine.js`, `server.py`) nem lógica de contagem de votos.
4. VALIDAÇÃO OBRIGATÓRIA:
   - Execute `python3 scratch/test_suite.py`.
   - Validação visual dos 4 temas nos navegadores.
5. ROLLBACK IMEDIATO:
   - `git checkout js/audience/audience-app.js css/`.
6. FINALIZAÇÃO:
   - Consolidar status geral do projeto como ESTÁVEL FINAL no Plano Mestre.
```

---
*Este documento é a fonte de verdade para a governança e evolução contínua do projeto SlideMeshLive.*

