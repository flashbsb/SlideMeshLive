# PLANO 09 — Módulo de Analytics Avançado & Histórico Multissessão Pós-Evento

> **Identificador:** `DEMANDA-09-ANALYTICS-HISTORICO-MULTISESSAO`  
> **Versão Alvo:** `v1.3.0`  
> **Status:** `100% CONCLUÍDO E HOMOLOGADO`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Alto (Auditoria de engajamento, retenção, relatórios executivos e inteligência de apresentação)`  
> **Classificação Técnica:** `RECOMENDADO (OFFLINE-FIRST & ZERO PII)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, COM RESSALVA DE PRIVACIDADE E DESEMPENHO OFFLINE:**
- **MÁ IDEIA (Rejeitada):** Integrar SDKs de rastreamento externos em nuvem (Google Analytics, Mixpanel, Segment) que exigiriam conexão contínua com a internet, violariam a autonomia offline em rede local e levantariam preocupações com LGPD/GDPR sobre identificação do público.
- **EXCELENTE IDEIA (Aprovada):** Implementar um motor analítico **100% autônomo, local e anônimo**, persistindo arquivos estruturados de auditoria (`sessions_archive/{sessionId}_analytics.json`) no disco do servidor Python, com gráficos em Canvas 2D/SVG nativos no painel da Mesa Técnica e exportação consolidada em CSV, JSON e HTML autônomo.

### 1.2 Problemas e Riscos Identificados

| Risco / Problema | Causa Raiz | Impacto Potencial | Mitigação Arquitetural Obrigatória |
|---|---|---|---|
| **Acúmulo Excessivo de Arquivos em Disco** | Dezenas de sessões arquivadas consumindo espaço desnecessário. | Lentidão de I/O no servidor. | **Política de rotação automática mantendo as últimas 50 sessões** (máx. 100KB por arquivo). |
| **Vazamento de Dados Pessoais (PII)** | Coleta de IPs ou informações identificáveis de participantes. | Não conformidade com LGPD/GDPR. | Anonimização estrita: apenas métricas agregadas por `uid` hash local efêmero. |
| **Queda de FPS na Mesa Técnica** | Renderização pesada de gráficos complexos via bibliotecas pesadas. | Travamento do painel do moderador. | Renderização via **Canvas 2D / SVG nativo vanilla**, sem bibliotecas externas pesadas. |

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Estrutura do Payload Analítico (`sessions_archive/{sessionId}_analytics.json`)

```json
{
  "sessionId": "CONF_TECH_2026_09",
  "presentationSlug": "slidemesh-showcase",
  "startTime": 1788260400000,
  "endTime": 1788264000000,
  "durationSeconds": 3600,
  "summary": {
    "totalParticipants": 84,
    "peakConcurrent": 79,
    "totalVotesCast": 142,
    "totalQuestionsSent": 28,
    "totalQuestionsApproved": 15,
    "totalUpvotes": 96
  },
  "slideMetrics": [
    { "slideIndex": 0, "title": "Capa", "dwellTimeSeconds": 180, "interactionCount": 0 },
    { "slideIndex": 1, "title": "Arquitetura", "dwellTimeSeconds": 320, "interactionCount": 0 },
    { "slideIndex": 2, "title": "Enquete Interativa", "dwellTimeSeconds": 240, "interactionCount": 78 }
  ],
  "pollBreakdown": [
    {
      "pollId": "poll-arch",
      "question": "Qual topologia você prefere?",
      "totalVotes": 78,
      "options": [
        { "id": "opt-mesh", "text": "Mesh Local", "votes": 52, "percentage": 66.6 },
        { "id": "opt-cloud", "text": "Cloud Only", "votes": 26, "percentage": 33.3 }
      ]
    }
  ],
  "topQuestions": [
    { "id": "q1", "text": "Como funciona o roteamento offline?", "upvotes": 24, "status": "approved" }
  ]
}
```

### 2.2 Endpoints de Backend (`server.py`)

1. `GET /api/analytics/history`: Retorna lista sumária das sessões arquivadas (`id`, `date`, `presentation`, `totalParticipants`, `duration`).
2. `GET /api/analytics/session?id={sessionId}`: Retorna o JSON completo de telemetria da sessão.
3. `POST /api/analytics/export`: Retorna arquivo para download (`csv` tabular ou `html` autônomo).

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Mapeamento de Métricas no `SessionManager` & Persistência no `server.py`
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 20)`
- Coleta em tempo real do tempo de permanência por slide (`dwellTime`) e agregação de votos/perguntas no encerramento da sessão (`RESET_SESSION` ou `ARCHIVE_SESSION`).
- Criação do diretório `sessions_archive/` com gravação atômica em disco.
- Rotação automática das 50 sessões mais recentes.
- Endpoints REST `/api/analytics/history`, `/api/analytics/session?id=XXX` e `POST /api/analytics/archive` 100% funcionais.

### Fase 2: Painel de Visualização na Mesa Técnica (`admin/index.html` & `admin-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 20)`
- Nova aba/modal "📊 Analytics & Histórico" na Mesa Técnica (`admin/index.html`).
- Renderizador de gráficos nativos em Canvas 2D:
  - Gráfico de barras de tempo de permanência por slide (*dwell time* em segundos com gradiente ciano/índigo e rótulos S1, S2...).
  - Painel de enquetes consolidadas com distribuição percentual de opções.
  - Tabela de ranking de dúvidas com maior número de upvotes.
  - Seletor de sessões arquivadas e botão de arquivamento instantâneo da sessão atual.

### Fase 3: Exportação Multiformato & Internacionalização (i18n)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 20)`
- Exportador para **CSV** estruturado (`exportAnalyticsCSV`) para análise no Excel/LibreOffice Calc com sessões, slides, enquetes e perguntas.
- Exportador para **HTML Autônomo com Gráficos Inline SVG** (`exportExecutiveHTMLReport`) com suporte a impressão e geração de PDF (`@media print`).
- Adição de chaves simétricas de tradução bilíngue (`admin.analytics_*` e `admin.analytics_export_html`) em `i18n-engine.js`.
- Botões de exportação direta na interface da Mesa Técnica (`#analytics-btn-export-html`, `#analytics-btn-export-csv`, `#analytics-btn-export-json`).

### Fase 4: Testes Automatizados e Resiliência (`scratch/test_suite.py`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 20)`
- Validação de gravação atômica e recuperação de dados analíticos via testes automatizados (Suíte 20).
- Teste de concorrência com 20 threads simultâneas de gravação e leitura sem colisões ou race conditions.
- Teste de resiliência a arquivos corrompidos e sanitização contra ataques de path traversal.
- Ausência de vazamento de memória e rotação automática mantendo as 50 sessões mais recentes.

---

## 4. ANÁLISE DE IMPACTO & ANTI-REGRESSÃO

| Pergunta de Controle | Resposta de Engenharia |
|---|---|
| **O que foi alterado?** | `server.py`, `js/core/session-manager.js`, `admin/index.html`, `js/admin/admin-app.js` e `js/core/i18n-engine.js`. |
| **Qual comportamento atual é preservado?** | O telão, a tela dos participantes e a moderação em tempo real continuam com zero overhead adicional. |
| **Existe risco de regressão?** | Não, pois a persistência de analytics é assíncrona e isolada na pasta `sessions_archive/`. |
| **Como testar a regressão?** | Executar as 20 suítes do `scratch/test_suite.py`. |
| **Existe rollback?** | Sim, reversão direta via Git sem migração de banco de dados. |

---

## 5. CRITÉRIOS DE ACEITE
- [x] Relatório de sessão gerado com acurácia de 100% de votos e perguntas.
- [x] Gráficos renderizados instantaneamente (<100ms) sem travar a thread principal da Mesa Técnica.
- [x] Exportação CSV e HTML autônomo 100% funcional offline com suporte a impressão/PDF (`@media print`).
- [x] 100% de aprovação na suíte automatizada de testes (20/20 suítes aprovadas).
