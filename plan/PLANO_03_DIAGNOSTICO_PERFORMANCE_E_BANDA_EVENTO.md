# PLANO 03 — Diagnóstico Pré-Voo de Performance, Capacidade de Audiência e Banda de Rede (*Event Pre-Flight & Capacity Engine*)

> **Identificador:** `DEMANDA-03-DIAGNOSTICO-BANDA-E-PERFORMANCE`  
> **Status:** `PROPOSTO PARA DECISÃO`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Crítico (Garante a estabilidade da infraestrutura e previne colapso de roteadores Wi-Fi em eventos presenciais)`  
> **Classificação Técnica:** `ALTAMENTE RECOMENDADO (DIFERENCIAL ENTERPRISE DE SEGURANÇA OPERACIONAL)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 É uma boa ideia?
**SIM, É UMA DAS MELHORES E MAIS IMPORTANTES MELHORIAS DO PROJETO!**

Em eventos presenciais locais (onde a plateia se conecta via Wi-Fi ou rede local sem internet externa), o principal ponto de falha não é o código da aplicação, mas sim a **capacidade de transferência de dados (Throughput) do roteador Wi-Fi local**.

### 1.2 O Cenário Real do Problema Apontado pelo Usuário
Imagine um slide contendo uma foto de 4MB. Quando o apresentador avança para este slide:
$$\text{Demanda de Rajada Instantânea} = 4\text{ MB} \times 30\text{ celulares} = 120\text{ MB em 1 segundo}$$
Se o roteador local for um modelo comum (ou Wi-Fi saturado de hotel com banda limitada a 20-30 Mbps), a rede sofre uma **rajada de saturação**, gerando:
1. Queda de conexões SSE.
2. Lentidão no carregamento das telas dos celulares.
3. Sensação de "aplicativo travado" para o público.

### 1.3 Solução Arquitetural
Desenvolver um **Motor de Diagnóstico Pré-Voo (*Pre-Flight Check*) e Monitor Contínuo de Saúde do Ambiente**, composto por:
1. **Auditoria Estática de Peso do Deck:** O servidor inspeciona todos os slides e assets, identificando antecipadamente slides pesados (> 500KB) e calculando a banda necessária por participante.
2. **Medição Contínua de Latência e Conexões:** Micro-pings no Admin e contagem de clientes simultâneos via SSE.
3. **Indicador de Capacidade e Semáforo de Risco na Mesa Técnica:** Avisos claros e didáticos (*"🟢 Ambiente Excelente: suporta até 120 celulares"* vs *"🟡 Alerta: Slide #3 tem 4.2MB — risco de lentidão em Wi-Fi simples"*).
4. **Otimizador Inteligente no Studio:** Aviso durante o upload de imagens recomendando compressão automática no navegador (< 300KB).

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Endpoint de Diagnóstico no Backend (`GET /api/diagnostics`)

O `server.py` expõe um endpoint leve e sem dependências pesadas que calcula:

```json
{
  "status": "healthy",
  "system": {
    "serverUptimeSec": 1420,
    "activeSessions": 1,
    "totalConnectedClients": 28,
    "sseSubscribers": 28,
    "memoryResidentMB": 38.4
  },
  "deckDiagnostics": {
    "presentationId": "slidemesh-showcase",
    "totalSlides": 10,
    "totalDeckWeightKB": 480,
    "heavySlides": [
      {
        "slideIndex": 3,
        "slideTitle": "Topologia SD-WAN",
        "assetName": "topo_cpe.png",
        "sizeKB": 2400,
        "warning": "Mídia > 1MB. Rajada para 30 pessoas: ~72MB."
      }
    ],
    "estimatedBandwidthPerAttendeeKB": 48,
    "recommendedMaxAudienceLocalWifi": 80,
    "healthScore": 92
  }
}
```

### 2.2 Painel HUD de Saúde do Ambiente na Mesa Técnica (`admin/index.html`)

Um novo card retrátil no Admin (**"🏥 Diagnóstico do Ambiente & Capacidade Wi-Fi"**):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏥 DIAGNÓSTICO DO AMBIENTE & CAPACIDADE WI-FI                          │
├────────────────────────────────────────────────────────────────────────┤
│ • Status da Rede Local: 🟢 100% Saudável (Latência média: 4ms)         │
│ • Participantes Ativos: 28 celulares conectados                        │
│ • Capacidade Estimada do Host/Wi-Fi: ~120 participantes simultâneos    │
│ • Peso Total da Apresentação: 620 KB (Média por slide: 62 KB)          │
│ • Alerta de Banda: ✅ Nenhum slide acima do limite recomendado (500KB) │
└────────────────────────────────────────────────────────────────────────┘
```

Se houver um slide com imagem pesada (ex: 4MB):
```
⚠️ ALERTA DE RISCO DE BANDA:
Slide #4 possui imagem de 4.1 MB ("foto_alta_res.png").
Em 30 celulares, gerará pico de 123 MB no roteador Wi-Fi.
💡 Recomendação: Utilize o SlideMesh Studio para otimizar para WebP (< 300 KB).
```

### 2.3 Compressão Inteligente no Studio (`import.html`)

Ao adicionar imagens no Studio (`import.html`):
- Se a imagem for > 500KB, o Studio oferece 1 clique: *"⚡ Otimizar Imagem (Reduzir para ~250KB sem perda visual)"*, usando a API nativa `<canvas>` do navegador antes de enviar ao servidor.

---

## 3. FASES DE IMPLANTAÇÃO INDIVIDUAL

### Fase 1: Módulo de Auditoria de Mídia e Endpoint de Diagnóstico (`server.py`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 17)`
- Implementação de `GET /api/diagnostics` no `server.py`.
- Auditoria estática de peso total do deck, cálculo de peso médio por slide e detecção precisa de slides pesados (> 500KB) com simulação de rajada (burst) para 30 e 50 celulares.
- Cálculo de métricas de sistema (Uptime, Memória RSS, Sessões Ativas, Conexões SSE) e capacidade recomendada de participantes locais em Wi-Fi.

### Fase 2: Painel de Diagnóstico na Mesa Técnica (`admin/index.html` & `admin-app.js`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 17)`
- Criação do card visual de Diagnóstico de Ambiente com semáforo de saúde (`#admin-diagnostics-card`, `#admin-diag-health-badge`) e medidores de capacidade Wi-Fi e latência local.
- Polling leve e não-intrusivo de diagnóstico a cada 10s (`fetchEnvironmentDiagnostics()`).
- Exibição de estatísticas do deck (peso total, peso médio por slide) e memória/uptime do servidor.
- Painel de alerta inteligente para slides com mídias pesadas e risco de saturação da rede local.
- Paridade completa de internacionalização com chaves simétricas em pt-BR e en-US (`i18n-engine.js`).

### Fase 3: Otimizador de Imagem Integrado no Studio (`import.html`)
- **Status:** `CONCLUÍDA — 100% VALIDADA COM TESTES AUTOMATIZADOS (Suíte 17)`
- Detecção em tempo real do peso da imagem vinculada ao slide no Studio com alerta de risco de saturação da rede Wi-Fi quando > 500KB (`#media-weight-alert`).
- Botão de auto-otimização 1-clique (`#btn-optimize-media`) convertendo e redimensionando a imagem client-side via HTML5 `<canvas>` para WebP Full HD (máx 1920x1080 com qualidade 0.82 e peso < 300KB).
- Atualização atômica do mapa de assets da apresentação convertida/editada.
- Suporte a internacionalização com `'import.btn_optimize_image'` em pt-BR e en-US (`i18n-engine.js`).

### Fase 4: Testes Automatizados, Simulação de Carga e Documentação Oficial (`scratch/test_suite.py` & `READMEs`)
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA (17/17 Suítes Aprovadas)`
- Teste de precisão do endpoint `/api/diagnostics` com métricas reais de Uptime, Memória RSS e Conexões ativas.
- Teste de detecção estática de mídias pesadas (>500KB) com simulação de rajada (burst) e penalização controlada no Score de Saúde.
- Teste de integração de UI no Admin (`admin/index.html` e `admin-app.js`) e Studio (`import.html`).
- Documentação do **Princípio 10 (Diagnóstico Pré-Voo, Auditoria de Mídia e Capacidade de Rede)** em `README.pt-BR.md` e `README.md`.

---

## 4. CRITÉRIOS DE ACEITE
- [x] O moderador visualiza em tempo real a latência, memória do servidor e capacidade estimada de participantes.
- [x] Apresentações com imagens pesadas (>500KB) disparam alertas claros com cálculo estimado de pico de rede.
- [x] O Studio permite compactar imagens pesadas no navegador com 1 clique antes da publicação.
- [x] 100% de aprovação na suíte de testes automatizados.
