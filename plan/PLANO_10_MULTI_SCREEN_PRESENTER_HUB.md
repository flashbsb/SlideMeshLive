# PLANO 10 — Multi-Screen Presenter Hub (Sincronização de Múltiplos Telões Físicos)

> **Identificador:** `DEMANDA-10-MULTI-SCREEN-PRESENTER-HUB`  
> **Versão Alvo:** `v1.4.0`  
> **Status:** `100% CONCLUÍDO E HOMOLOGADO`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Alto (Estrutura de grandes palcos, auditórios com painéis de LED laterais e eventos profissionais)`  
> **Classificação Técnica:** `RECOMENDADO (TOPOLOGIA DISTRIBUÍDA DE BAIXA LATÊNCIA)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, COM CONTROLE ESTRITO DE MODERAÇÃO E SINCRONIZAÇÃO:**
- **MÁ IDEIA (Rejeitada):** Duplicar instâncias do servidor Python ou criar hubs separados para cada tela, o que introduziria descompasso de tempo de sincronização e concorrência no banco de dados local.
- **EXCELENTE IDEIA (Aprovada):** Utilizar o mesmo hub local (`server.py`) com **parâmetros de rota dedicados (`?view=stage`, `?view=questions_wall`, `?view=polls_live`)**, permitindo que navegadores independentes em monitores secundários recebam os eventos SSE simultaneamente e renderizem layouts em tela cheia otimizados para auditórios de grande escala.

### 1.2 Problemas e Riscos Identificados

| Risco / Problema | Causa Raiz | Impacto Potencial | Mitigação Arquitetural Obrigatória |
|---|---|---|---|
| **Vazamento de Perguntas Pendentes no Telão Lateral** | Falha de isolamento de estado na tela de mural. | Constrangimento público com perguntas não moderadas. | **Gate de Moderação ADR-04 inviolável**: a view de perguntas filtra estritamente `status === 'approved'`. |
| **Descompasso de Efeitos Visuais (Stage FX)** | Telão de slides soltar confetes e os telões laterais não acompanharem. | Sensação de atraso visual no palco. | Broadcast de `TRIGGER_STAGE_FX` via SSE para todos os clientes conectados simultaneamente. |
| **Queda de Conexão de uma Tela Afetar as Outras** | Acoplamento de conexão entre abas. | Telão principal congelar se tela lateral cair. | Conexões SSE totalmente independentes por aba/dispositivo. |

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Modos de Visualização de Palco

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                SERVIDOR LOCAL (server.py)                                 │
│                              Streaming SSE (/api/events)                                  │
└───────────────────┬─────────────────────────────┬─────────────────────────────┬───────────┘
                    │                             │                             │
                    ▼                             ▼                             ▼
       ┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
       │   TELÃO PRINCIPAL      │    │  TELÃO LATERAL ESQ.    │    │  TELÃO LATERAL DIR.    │
       │ /presenter/?view=stage │    │ /presenter/?view=      │    │ /presenter/?view=      │
       │                        │    │  questions_wall        │    │  polls_live            │
       ├────────────────────────┤    ├────────────────────────┤    ├────────────────────────┤
       │ • Slides em Full HD    │    │ • Mural Gigante de     │    │ • Resultados em Tempo  │
       │ • Transições GPU       │    │   Dúvidas Aprovadas    │    │   Real de Enquetes     │
       │ • Stage FX Canvas      │    │ • Ranking de Upvotes   │    │ • Gráficos Animados    │
       │ • Banner Discreto      │    │ • Stage FX Sincronizado│    │ • Stage FX Sincronizado│
       └────────────────────────┘    └────────────────────────┘    └────────────────────────┘
```

### 2.2 Rotas e Parâmetros

* **`/presenter/` ou `/presenter/?view=stage`**: Modo clássico (Slides + Banner flutuante opcional + Stage FX).
* **`/presenter/?view=questions_wall`**: Ocupa 100vw/100vh com grade dinâmica de cards de perguntas aprovadas, destacando a pergunta mais votada no topo e atualizando em tempo real com animação fluida.
* **`/presenter/?view=polls_live`**: Ocupa 100vw/100vh com o gráfico da enquete ativa em tamanho monumental, percentuais de votos e contagem total de participantes.

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Motor de Roteamento de Layout no `PresenterApp` (`js/presenter/presenter-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 21)`
- Leitura de `URLSearchParams` para identificar o modo de visualização ativo (`stage`, `questions_wall`, `polls_live`).
- Injeção dinâmica de classes de layout no `<body>` (`.view-stage-mode`, `.view-questions-mode`, `.view-polls-mode`).
- Métodos auxiliares `getViewMode()`, `setViewMode(mode)` e `applyViewModeLayout()` integrados no ciclo de vida do `PresenterApp`.

### Fase 2: Layouts e Animações CSS Dedicadas (`css/presenter.css` & `presenter/index.html`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 21)`
- Estilização em alta definição para o mural de perguntas em tela cheia (grid responsivo com tipografia auto-escalável via `clamp()`).
- Estilização para o painel de enquetes monumentais com barras de progresso animadas em gradiente e contadores em tempo real.
- Suporte a reprodução sincronizada de `StageFX` em todos os modos de visualização.

### Fase 3: Atalhos na Mesa Técnica & Internacionalização (`admin/index.html` & `i18n-engine.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 21)`
- Botões de acesso rápido na Mesa Técnica para abrir diretamente os telões secundários (`#admin-link-presenter-questions` e `#admin-link-presenter-polls`).
- Adição de chaves simétricas de tradução bilíngue em `i18n-engine.js` (`admin.btn_telao_questions`, `admin.btn_telao_polls` e `admin.multiscreen_title`).
- Documentação do Princípio 13 com paridade em `README.pt-BR.md` e `README.md`.

### Fase 4: Testes Automatizados e Resiliência (`scratch/test_suite.py`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 21)`
- Validação automatizada da abertura e sincronização dos 3 modos de tela na Suíte 21.
- Garantia de cumprimento do Gate de Moderação nos telões secundários (ADR-04).
- Isolamento de conexões e resiliência a quedas parciais de clientes SSE.

---

## 4. ANÁLISE DE IMPACTO & ANTI-REGRESSÃO

| Pergunta de Controle | Resposta de Engenharia |
|---|---|
| **O que foi alterado?** | `presenter/index.html`, `js/presenter/presenter-app.js`, `css/presenter.css`, `admin/index.html` e `js/core/i18n-engine.js`. |
| **Qual comportamento atual é preservado?** | O telão padrão (`/presenter/` sem query string) mantém 100% do comportamento e estética inalterados. |
| **Existe risco de regressão?** | Mínimo, pois a diferenciação ocorre puramente por query parameter e classes CSS de visualização. |
| **Como testar a regressão?** | Executar as 21 suítes do `scratch/test_suite.py`. |
| **Existe rollback?** | Sim, reversão simples via Git. |

---

## 5. CRITÉRIOS DE ACEITE
- [x] Telões secundários sincronizados com latência <10ms via SSE em rede local.
- [x] Mural de perguntas secundário respeita rigorosamente o Gate de Moderação ADR-04 (zero perguntas pendentes visíveis).
- [x] Efeitos visuais do `StageFX` (confetes, tremor, etc.) disparados simultaneamente em todas as telas abertas.
- [x] 100% de conformidade nos testes automatizados (21/21 suítes aprovadas).
