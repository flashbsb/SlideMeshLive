# PLANO 01 — Transições e Animações Dinâmicas no Telão (*Clean Stage Transitions*)

> **Identificador:** `DEMANDA-01-TRANSICOES-TELAO`  
> **Status:** `PROPOSTO PARA DECISÃO`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Alto (Elevação estética, engajamento visual de nível Keynote/Apple)`  
> **Classificação Técnica:** `RECOMENDADO COM DIRETRIZES DE PERFORMANCE RIGOROSAS`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, É UMA EXCELENTE MELHORIA**, desde que projetada com foco absoluto em **aceleração de hardware via GPU (CSS Transform/Opacity)** e **zero dependências externas pesadas**.

Transições visuais suaves entre slides transformam a experiência de uma projeção web simples para uma ferramenta de nível executivo comparável a softwares nativos como *Apple Keynote*, *Pitch* ou *PowerPoint*.

### 1.2 Problemas e Riscos Identificados

| Risco / Problema | Causa Raiz | Impacto Potencial | Mitigação Arquitetural Obrigatória |
|---|---|---|---|
| **Queda de FPS (Jank/Stutter)** | Animações que forçam *reflow/repaint* no DOM (ex: animar `width`, `margin`, `top`, `left`). | Telão engasgando em notebooks fracos de auditórios. | **Uso estrito de `transform` e `opacity`** (camada de composição acelerada por GPU). |
| **Atraso na Sincronização Mobile** | Animação no telão demorar 2s enquanto o celular troca instantaneamente. | Sensação de perda de sincronia pelo participante. | **Duração padrão de 350ms a 450ms**, mantendo a transição rápida, fluida e instantaneamente sincronizada. |
| **Tontura / Acessibilidade (Vestibular Motion)** | Movimentos bruscos em telões gigantes de 150 polegadas. | Desconforto visual para parte do público. | Suporte nativo ao `prefers-reduced-motion: reduce` desativando animações pesadas automaticamente. |
| **Incompatibilidade por Slide** | Alguns slides (como enquetes e gráficos) exigem estabilidade, outros exigem destaque. | Poluição visual e transições inadequadas. | **Configuração granular por slide** com herança de um padrão global da apresentação. |

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Presets de Transições Disponíveis

Definiremos 5 presets profissionais, elegantes e de alta performance:

```
┌─────────────────┬──────────────────────────────────────────┬────────────────────────┐
│ Preset          │ Comportamento Visual                     │ Aplicação Recomendada  │
├─────────────────┼──────────────────────────────────────────┼────────────────────────┤
│ 1. 'fade'       │ Dissolvimento suave de opacidade         │ Padrão Universal       │
│ 2. 'slide'      │ Deslizamento horizontal com desaceleração│ Narrativas sequenciais │
│ 3. 'zoom'       │ Zoom sutil de profundidade (0.96 ➔ 1.0) │ Slides conceituais     │
│ 4. 'dissolve'   │ Cross-fade com leve desfoque óptico      │ Capas e encerramentos  │
│ 5. 'stagger'    │ Entrada em cascata dos tópicos/bullets   │ Slides com listas      │
└─────────────────┴──────────────────────────────────────────┴────────────────────────┘
```

### 2.2 Estrutura de Dados (`manifest.json` e `slides.json`)

1. **Padrão no `manifest.json`:**
```json
{
  "theme": {
    "transition": "slide",
    "transitionDuration": 400
  }
}
```

2. **Customização por Slide no `slides.json`:**
```json
{
  "id": 3,
  "title": "Arquitetura do Hub Local",
  "presenter": {
    "transition": "stagger",
    "headline": "Arquitetura do Hub Local",
    "bullets": ["Camada de Transporte", "Isolamento de Memória"]
  }
}
```

### 2.3 Motor CSS Acelerado por GPU (`css/presenter.css` & `css/animations.css`)

```css
/* Transições de alta performance aceleradas por hardware */
.stage-slide-content {
  will-change: transform, opacity;
  transition: transform var(--stage-trans-duration, 400ms) cubic-bezier(0.16, 1, 0.3, 1),
              opacity var(--stage-trans-duration, 400ms) cubic-bezier(0.16, 1, 0.3, 1);
}

/* Modo Slide Horizontal */
.stage-transition-slide.stage-enter-right {
  transform: translate3d(60px, 0, 0);
  opacity: 0;
}
.stage-transition-slide.stage-enter-left {
  transform: translate3d(-60px, 0, 0);
  opacity: 0;
}
.stage-transition-slide.stage-active {
  transform: translate3d(0, 0, 0);
  opacity: 1;
}

/* Modo Stagger Bullets (Cascata elegante) */
.stage-stagger-bullet {
  opacity: 0;
  transform: translateY(12px);
  animation: stageBulletEnter 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes stageBulletEnter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Motor CSS de Transições e Renderizador no Telão (`presenter-app.js`, `presentation-engine.js` & `css/presenter.css`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 18)`
- Criação dos 5 presets de transição acelerados por GPU: `fade`, `slide`, `zoom`, `dissolve` e `stagger`.
- Rastreamento de direção de slide (`prev` vs `next`) no `PresenterApp` com aplicação de `stage-trans-slide-next` e `stage-trans-slide-prev`.
- Suporte a escalonamento suave de bullets no modo `stagger` com delays progressivos calculados.
- Suporte a acessibilidade WCAG com fallback instantâneo em `@media (prefers-reduced-motion: reduce)`.

### Fase 2: Seletor de Transição no SlideMesh Studio (`import.html` & `conversion-engine.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 18)`
- Adição de seletor de "Transição do Telão" global na barra de metadados (`#cfg-transition`) e dropdown individual por slide na coluna do Telão (`#edit-slide-transition`).
- Persistência atômica das propriedades no `manifest.json` (`theme.transition` e `theme.transitionDuration`) e `slides.json` (`presenter.transition`).
- Inclusão de transição padrão nos templates estruturados do `ConversionEngine`.
- Paridade completa de internacionalização com chaves simétricas em pt-BR e en-US (`i18n-engine.js`).

### Fase 3: A11Y, Fallbacks, Testes Automatizados e Documentação Oficial (`scratch/test_suite.py` & `READMEs`)
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA (18/18 Suítes Aprovadas)`
- Suporte a acessibilidade WCAG com `@media (prefers-reduced-motion: reduce)` em `presenter.css`.
- Teste automatizado cobrindo os 5 presets, injeção de transição, detecção de direção de navegação, seletores de Studio e i18n (Suíte 18).
- Inclusão do **Princípio 11 (Transições Cinematográficas e Animações no Telão)** em `README.pt-BR.md` e `README.md`.

---

## 4. CRITÉRIOS DE ACEITE
- [x] Troca de slides no telão ocorre de forma suave em 60fps sem oscilação de layout.
- [x] Transições respeitam o tipo selecionado (`fade`, `slide`, `zoom`, `dissolve`, `stagger`).
- [x] Nenhum impacto de atraso na sincronização mobile dos smartphones.
- [x] 100% de aprovação na suíte de testes automatizados.
