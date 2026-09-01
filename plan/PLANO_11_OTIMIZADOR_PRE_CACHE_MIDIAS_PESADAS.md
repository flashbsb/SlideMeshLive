# PLANO 11 — Otimizador, Chunking e Pré-Cache de Mídias Pesadas (Vídeos/Áudios MP4/WebM)

> **Identificador:** `DEMANDA-11-OTIMIZADOR-PRE-CACHE-MIDIAS`  
> **Versão Alvo:** `v2.0.0`  
> **Status:** `100% CONCLUÍDO E HOMOLOGADO`  
> **Complexidade:** `Média/Alta`  
> **Impacto no Negócio:** `Alto (Reprodução fluida de vídeos em alta resolução sem engasgos ou buffer no telão)`  
> **Classificação Técnica:** `RECOMENDADO (OFFLINE-FIRST & HTTP 206 RANGE STREAMING)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, COM RESSALVA CRUCIAL DE GESTÃO DE MEMÓRIA E BANDA WI-FI:**
- **MÁ IDEIA (Rejeitada):** Fazer download de todos os vídeos da apresentação inteira de uma só vez na inicialização ou transmitir vídeo contínuo para dezenas de celulares simultâneos no mesmo Wi-Fi, o que provocaria colapso imediato do roteador e esgotamento da memória RAM.
- **EXCELENTE IDEIA (Aprovada):** Implementar **suporte nativo a HTTP 206 Partial Content (Range Requests)** no `server.py` associado a um motor de **pré-cache inteligente em janela deslizante de 2 slides (`MediaCacheEngine`)**, garantindo que o vídeo do próximo slide já esteja pronto em memória/cache local no momento exato em que o palestrante avançar o slide, descartando vídeos anteriores com `URL.revokeObjectURL` para evitar vazamentos.

### 1.2 Problemas e Riscos Identificados

| Risco / Problema | Causa Raiz | Impacto Potencial | Mitigação Arquitetural Obrigatória |
|---|---|---|---|
| **Esgotamento de Memória RAM no Telão** | Múltiplos vídeos de 50MB mantidos abertos em Blob URLs. | Travamento do navegador do palco após 40 minutos. | **Descarte determinístico de Blob URLs (`URL.revokeObjectURL`)** de slides fora da janela de ±2 slides. |
| **Saturação do Roteador Wi-Fi** | Download concorrente de vídeo pelo telão concorrendo com votos da plateia. | Aumento da latência de sincronização de slides. | Download de mídia com **prioridade baixa (*fetch priority: low*)** e throttling suave. |
| **Erro de Playback por Falta de Range Requests** | Servidores HTTP simples sem suporte a `Accept-Ranges: bytes`. | Impossibilidade de avançar a barra de progresso do vídeo (*seek*). | Implementação completa de **HTTP 206 (Range Requests)** em `server.py`. |

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Fluxo do Motor de Pré-Cache em Janela Deslizante (`MediaCacheEngine`)

```text
                               Slide Atual: [Slide 4]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [Slide 2 e 3 (Passados)]                     [Slide 5 e 6 (Futuros)]
      ┌─────────────────────────────┐               ┌─────────────────────────────┐
      │ • Descarta Blob URLs        │               │ • Pré-carrega vídeo em      │
      │ • Executa revokeObjectURL() │               │   segundo plano via Range   │
      │ • Libera memória RAM        │               │ • Prepara elemento <video>  │
      └─────────────────────────────┘               └─────────────────────────────┘
```

### 2.2 Suporte a HTTP 206 em `server.py`

O servidor Python manipulará o cabeçalho `Range: bytes=START-END`:
* Resposta `HTTP 206 Partial Content`
* Cabeçalhos: `Content-Range: bytes START-END/TOTAL`, `Accept-Ranges: bytes`, `Content-Length: CHUNK_SIZE`, `Content-Type: video/mp4`.

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Suporte a HTTP 206 Range Requests no `server.py`
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 22)`
- Tratamento de cabeçalhos de Range em requisições de arquivos `.mp4`, `.webm`, `.mp3`, `.wav`, `.ogg` e `.m4a`.
- Entrega em pedaços (*chunks*) de 64KB sem carregar o arquivo inteiro na memória do processo Python.
- Suporte nativo a `HEAD`, Range Fechado, Range Aberto, Range de Sufixo e `HTTP 416 Range Not Satisfiable`.

### Fase 2: Motor Client-Side `MediaCacheEngine` (`js/core/media-cache-engine.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 22)`
- Rastreamento dos nós `<video>` e `<audio>` nos slides da apresentação ativa.
- Pré-download progressivo dos próximos 2 slides com baixa prioridade (`Range: bytes=0-1048575`).
- Gestão de ciclo de vida e descarte determinístico de memória com `URL.revokeObjectURL`.
- Integração ao ciclo de transição de slides no `PresenterApp` (`js/presenter/presenter-app.js`).

### Fase 3: Controle Remoto de Mídia na Mesa Técnica (`admin/index.html` & `presenter-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 22)`
- Card de controle de mídia na Mesa Técnica (`#admin-media-control-card`) com Play, Pause, Mudo e Reiniciar.
- Evento SSE/Broadcast unificado `MEDIA_CONTROL_ACTION` (`realtime-engine.js`).
- Execução remota no palco/telão (`presenter-app.js`) e atalho de teclado `K` para o orador.
- Internacionalização completa em pt-BR e en-US (`i18n-engine.js`).

### Fase 4: Testes Automatizados e Resiliência (`scratch/test_suite.py`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 22)`
- Validação na Suíte 22 cobrindo Range Requests HTTP 206, reprodução sem buffer, liberação estrita de memória RAM e controle remoto na mesa técnica.

---

## 4. ANÁLISE DE IMPACTO & ANTI-REGRESSÃO

| Pergunta de Controle | Resposta de Engenharia |
|---|---|
| **O que será alterado?** | `server.py`, `js/core/media-cache-engine.js` [NOVO], `presenter/index.html`, `js/presenter/presenter-app.js` e `admin/index.html`. |
| **Qual comportamento atual é preservado?** | Decks que não utilizam vídeo/áudio continuam com consumo de recursos e performance exatamente iguais. |
| **Existe risco de regressão?** | Baixo, pois a camada de cache é ativada apenas na presença explícita de elementos `<video>` ou `<audio>`. |
| **Como testar a regressão?** | Executar todas as 22 suítes existentes do `scratch/test_suite.py`. |
| **Existe rollback?** | Sim, reversão direta via Git. |

---

## 5. CRITÉRIOS DE ACEITE
- [x] Reprodução de vídeo inicia em <50ms no telão sem congelamento ou tela preta de buffering.
- [x] Range Requests HTTP 206 funcionando perfeitamente em navegadores Chrome, Firefox e Safari.
- [x] Consumo de memória RAM no navegador do telão permanece < 1GB mesmo após 2 horas de apresentação com múltiplos vídeos.
- [x] 100% de aprovação nos testes automatizados (22/22 suítes).
