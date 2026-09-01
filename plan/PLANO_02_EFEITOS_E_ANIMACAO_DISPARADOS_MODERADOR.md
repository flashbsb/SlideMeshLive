# PLANO 02 — Efeitos Visuais Dinâmicos Disparados pelo Moderador (*Stage FX Deck*)

> **Identificador:** `DEMANDA-02-EFEITOS-MODERADOR`  
> **Status:** `CONCLUÍDA & HOMOLOGADA (100%)`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Médio/Alto (Gamificação, dinamismo em momentos-chave e encerramento de enquetes)`  
> **Classificação Técnica:** `RECOMENDADO COM ARQUITETURA NÃO-DESTRUTIVA (OVERLAY TRANSIENTE)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, COM RESSALVA CRUCIAL DE DESIGN:**  
- **MÁ IDEIA (Rejeitada):** Destruir o DOM do slide (ex: estilhaçar elementos reais da tela), pois isso corrompe o layout, quebra o estado da apresentação e causa pânico no palestrante.
- **EXCELENTE IDEIA (Aprovada):** Implementar uma **Camada de Efeitos Visuais Não-Destrutiva (*Stage FX Overlay Layer*)**, onde partículas, ondas de choque (*shockwave/shake*), confetes, holofotes (*spotlight*) e contagens regressivas são renderizados em um `<canvas>` translúcido flutuante com **auto-limpeza (auto-cleanup) em 1.5 a 3.0 segundos**.

### 1.2 Problemas e Riscos Identificados

| Risco / Problema | Causa Raiz | Impacto Potencial | Mitigação Arquitetural Obrigatória |
|---|---|---|---|
| **Poluição Visual ou Spam** | Moderador clicar repetidamente no botão de explosão/efeito. | Telão poluído, PALESTRANTE irritado e queda de FPS. | **Rate-limit / Cooldown de 3s no painel do moderador** + auto-cleanup no telão. |
| **Degradação de Performance** | Criação contínua de milhares de nós DOM para partículas. | Vazamento de memória e travamento do navegador. | Renderização via **Canvas 2D com `requestAnimationFrame`** e destruição automática após animação. |
| **Interrupção da Leitura** | Efeito cobrir o conteúdo do slide por muito tempo. | Dificuldade do público em ler os tópicos. | **Tempo máximo de exibição de 2.5 segundos** e opacidade balanceada. |

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Paleta de Efeitos do Moderador (*Stage FX Pack*)

```
┌──────────────────────────┬──────────────────────────────────────────┬─────────────────────────────┐
│ Efeito                   │ Comportamento Visual                     │ Caso de Uso Didático        │
├──────────────────────────┼──────────────────────────────────────────┼─────────────────────────────┤
│ 1. 🎉 'confetti'         │ Chuva de confetes coloridos (2.5s)       │ Revelação de enquete/vitória│
│ 2. 💥 'impact_shake'     │ Tremor sutil da tela + onda de choque    │ Ponto de ruptura/anúncio    │
│ 3. 🔦 'spotlight'        │ Holofote/foco escurecendo o restante     │ Chamar atenção total        │
│ 4. ⏱️ 'countdown_burst'  │ Contagem 3-2-1 gigante flutuante         │ Encerramento de dinâmica    │
│ 5. ✨ 'glitch_flash'      │ Flash sutil de energia com partículas    │ Revelação de novidade       │
└──────────────────────────┴──────────────────────────────────────────┴─────────────────────────────┘
```

### 2.2 Camada Visual no Telão (`presenter/index.html`)

No HTML do telão (`presenter/index.html`), adiciona-se uma camada transparente de alta prioridade (`pointer-events: none`):

```html
<canvas id="stage-fx-canvas" style="position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 9999; display: none;"></canvas>
```

### 2.3 Fluxo de Disparo em Tempo Real

```
┌─────────────────────────┐
│ 🛡️ Mesa Técnica (Admin)  │
│ [Disparar Confetti 🎉]  │
└────────────┬────────────┘
             │ 1. POST /api/sync (type: TRIGGER_STAGE_FX, payload: { fx: 'confetti' })
             ▼
┌─────────────────────────┐
│ 🐍 Hub Python (server)  │
└────────────┬────────────┘
             │ 2. Broadcast instantâneo SSE (/api/events)
             ▼
┌─────────────────────────┐
│ 🖥️ Telão (PresenterApp)  │ ➔ 3. Executa StageFX.play('confetti') no Canvas
│                         │ ➔ 4. Auto-limpeza após 2.5 segundos
└─────────────────────────┘
```

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Módulo de Efeitos Canvas no Palco (`js/presenter/stage-fx.js` & `presenter-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 19)`
- Criação do motor `StageFX` em `stage-fx.js` com 5 presets acelerados em Canvas 2D (`confetti`, `impact_shake`, `spotlight`, `countdown_burst`, `glitch_flash`).
- Inserção do `<canvas id="stage-fx-canvas">` flutuante em `presenter/index.html` com `pointer-events: none` e `z-index: 9999`.
- Integração de eventos em tempo real (`TRIGGER_STAGE_FX`) no `PresenterApp` e `RealtimeEngine` com auto-limpeza em 1.5-2.5 segundos.

### Fase 2: Painel de Controle de Efeitos na Mesa Técnica (`admin/index.html` & `admin-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 19)`
- Dock de botões de efeitos rápidos na Mesa Técnica (`#admin-stage-fx-card` em `admin/index.html`) para os 5 presets (`confetti`, `impact_shake`, `spotlight`, `countdown_burst`, `glitch_flash`).
- Cooldown visual de 3 segundos com bloqueio de botões e contador regressivo (`#admin-fx-cooldown-badge`) no `admin-app.js` para prevenção de spam.
- Chaves simétricas de tradução bilíngue em `i18n-engine.js` (pt-BR e en-US).

### Fase 3: Atalhos no Púlpito do Apresentador (`presenter/index.html` & `presenter-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 19)`
- Dock de botões de efeitos de palco rápidos no Púlpito do Apresentador (`#pulpit-sidebar` em `presenter/index.html`).
- Atalhos de teclado no telão/púlpito: tecla `C` para chuva de confetes e tecla `X` para tremor de impacto/onda de choque.
- Cooldown local de 3 segundos no Púlpito com contador regressivo (`#pulpit-fx-cooldown-badge`) e tradução i18n sincronizada.

### Fase 4: Testes Automatizados, Documentação Oficial e Resiliência (`scratch/test_suite.py`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 19)`
- Validação de envio e recepção de `TRIGGER_STAGE_FX` via SSE e Hub HTTP.
- Cooldown anti-spam de 3s e ausência de vazamento de memória com auto-limpeza em 1.5 a 2.6s.
- Documentação oficial do Princípio 12 (*Stage FX Deck*) e inclusão de `stage-fx.js` em `README.pt-BR.md` e `README.md`.

---

## 4. CRITÉRIOS DE ACEITE
- [x] O disparo de efeitos não altera e não destrói o DOM do slide ativo.
- [x] O efeito é reproduzido com latência imperceptível (<50ms via SSE) no telão.
- [x] Cooldown impede disparos repetidos sucessivos que possam travar o navegador.
- [x] 100% de conformidade nos testes automatizados.
