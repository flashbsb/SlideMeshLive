# PLANO 16: SUÍTE COMPLETA DE MANUAIS VIVOS & GUIAS PRÁTICOS DO SLIDEMESHLIVE (7 APRESENTAÇÕES INTERATIVAS)

## 1. Visão Geral e Filosofia de Design

O **SlideMeshLive** é uma plataforma moderna para apresentações em tempo real com arquitetura desacoplada e sincronização sub-50ms. Em vez de manuais em PDF ou documentações externas estáticas, o SlideMeshLive adota a filosofia **"Show, Don't Tell" (*Interactive Living Manuals*)**:

> **Princípio:** O usuário aprende a usar, configurar e operar cada recurso do SlideMeshLive **navegando por apresentações interativas dentro da própria ferramenta**. Cada slide ensina o passo a passo prático ("Pressione [P]", "Clique no botão X na Mesa Técnica", "Configure a chave Y no manifest.json") enquanto demonstra visualmente o recurso em funcionamento.

---

## 2. Mapa das 3 Trilhas & 7 Apresentações Oficiais

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      SUÍTE OFICIAL DE MANUAIS VIVOS DO SLIDEMESHLIVE (7 GUIAS)                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🚀 TRILHA 1: ONBOARDING & VISÃO GERAL DO ECOSSISTEMA                                             │
│  1. ⭐ comece-por-aqui: Mapa do Ecossistema & Guia das Interfaces                                │
│  2. 🌟 slidemesh-showcase: Guia Demonstrativo & Tour Oficial                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛠️ TRILHA 2: PALCO, CRIAÇÃO & OPERAÇÃO                                                           │
│  3. 🎨 guia-animacoes-e-palco: Transições de Telão, Efeitos Canvas 2D & Mídia HTTP 206           │
│  4. 📦 guia-criacao-studio-zip: SlideMesh Studio — Criação, Importação & Portabilidade ZIP       │
│  5. 💬 guia-moderacao-e-analytics: Mesa Técnica — Moderação de Q&A & Gestão de Enquetes          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🛡️ TRILHA 3: INFRAESTRUTURA, SEGURANÇA & SUPORTE EM EVENTOS AO VIVO                              │
│  6. 🔒 treinamento-interno-pin: Segurança, PINs de Acesso & Gestão de Usuários RBAC             │
│  7. 🩺 guia-diagnostico-troubleshooting: Diagnóstico de Rede, Monitoramento & Resolução de Falhas│
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificação Completa dos 7 Manuais Vivos

---

### 🚀 TRILHA 1: ONBOARDING & VISÃO GERAL

#### 1. ⭐ `comece-por-aqui` — "Comece por Aqui: Mapa do Ecossistema & Guia das Interfaces"
- **Público-Alvo:** Novos desenvolvedores, palestrantes e operadores ao clonar o repositório.
- **Identidade Visual:** Primária `#38bdf8` (Sky Blue), Acento `#818cf8` (Indigo), Fundo `#0b0f19`, Transição `fade` (350ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`onboarding-intro`):** *Bem-vindo ao SlideMeshLive!*
    - **Telão:** Apresentação da arquitetura desacoplada (Telão limpo + Celular da plateia + Mesa Técnica).
    - **Celular:** Guia de onboarding com links rápidos e explicativo de sincronização local LAN sem nuvem.
    - **Notas Púlpito:** *"Dê as boas-vindas e peça para todos apontarem a câmera para o QR Code no rodapé."*
    - **Asset SVG:** `ecosystem-map.svg` (Diagrama visual das 3 pontas conectadas).
  - **Slide 2 (`mapa-das-interfaces`):** *O Escopo das 5 Interfaces Web*
    - **Telão:** Resumo dos 5 módulos: Portal (`/`), Telão (`/presenter`), Mesa Técnica (`/admin`), Celular (`/audience`) e Studio (`/import.html`).
    - **Celular:** Tabela interativa detalhando a rota, o perfil de usuário e as principais ações de cada tela.
    - **Notas Púlpito:** *"Explique que cada tela foi projetada para um papel específico sem poluição visual."*
  - **Slide 3 (`trilha-de-aprendizado`):** *A Trilha dos 7 Manuais Vivos*
    - **Telão:** Mapeamento visual das 3 trilhas (Onboarding, Operação e Infra/Segurança).
    - **Celular:** Lista com cards clicáveis descrevendo o objetivo de cada uma das 7 apresentações do catálogo.
  - **Slide 4 (`como-executar-local`):** *Execução em 1 Comando & Rede Local*
    - **Telão:** Instruções de terminal: `python3 server.py --port 8080`, links de Wi-Fi e porta local.
    - **Celular:** Checklist passo a passo de como conectar múltiplos smartphones no mesmo roteador sem internet.
  - **Slide 5 (`enquete-perfil-usuario`):** *Diagnóstico de Uso*
    - **Enquete:** *"Qual o seu perfil de uso principal no SlideMeshLive hoje?"*
    - **Opções:** `A) Palestrante / Orador`, `B) Produtor de Eventos / Mesa Técnica`, `C) Desenvolvedor / TI`, `D) Instrutor / RH Corporativo`.

---

#### 2. 🌟 `slidemesh-showcase` — "SlideMeshLive: Guia Demonstrativo & Tour Oficial"
- **Público-Alvo:** Demonstração completa integrada de todos os recursos da plataforma (10 slides existentes revisados).
- **Identidade Visual:** Primária `#38bdf8`, Acento `#818cf8`, Fundo `#0b0f19`, Transição `fade` (380ms).
- **Destaques:** Quebra-gelo com cálculo em tempo real, sincronização LAN sub-50ms, modo Púlpito (`P`), atalhos de palco, mural de perguntas (`M`), 4 temas visuais e exportação de pacotes ZIP.

---

### 🛠️ TRILHA 2: PALCO, CRIAÇÃO & OPERAÇÃO

#### 3. 🎨 `guia-animacoes-e-palco` — "Manual Prático: Transições de Telão, Efeitos & Controle de Mídia"
- **Público-Alvo:** Palestrantes e designers que desejam apresentações visualmente impactantes.
- **Identidade Visual:** Primária `#ec4899` (Pink Glow), Acento `#8b5cf6` (Purple), Fundo `#090d16`, Transição `zoom` (400ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`transicoes-visuais`):** *As 4 Transições Nativas de Slide*
    - **Telão:** Demonstração visual de como declarar `fade`, `zoom`, `slide-horizontal` ou `slide-vertical` no `manifest.json`.
    - **Celular:** Guia de sintaxe JSON do bloco `"theme": { "transition": "zoom", "transitionDuration": 400 }`.
    - **Notas Púlpito:** *"Observe a transição de zoom suave ao avançar este slide."*
    - **Asset SVG:** `transition-types.svg` (Diagrama dos 4 movimentos de tela).
  - **Slide 2 (`efeitos-canvas-2d`):** *Efeitos Especiais de Palco em Canvas 2D*
    - **Telão:** Demonstração dos motores visuais de aceleração gráfica: confetes, partículas e celebrações.
    - **Celular:** Como disparar efeitos especiais pelo console do Admin ou via gatilhos de eventos.
    - **Notas Púlpito:** *"Pressione as teclas de efeito configuradas para surpreender o auditório."*
  - **Slide 3 (`controle-midia-http206`):** *Controle Remoto de Vídeo e Áudio com Pré-Cache*
    - **Telão:** Como o motor `MediaCacheEngine` pré-carrega vídeos/áudios na janela ±2 slides via HTTP 206 Range Requests sem travar a rede.
    - **Celular:** Instruções de como a Mesa Técnica usa os botões Play, Pause, Reiniciar e Mudo remotamente.
    - **Asset SVG:** `media-cache-sliding-window.svg` (Janela deslizante de pré-cache ±2 slides).
  - **Slide 4 (`atalhos-palco-orador`):** *Mestria nos Atalhos de Teclado*
    - **Telão:** Tabela com os atalhos de ouro: `P` (Púlpito), `Q` (QR gigante), `W` (Mini QR), `M` (Mural de Perguntas) e `B` (Blackout de foco).
    - **Celular:** Guia de bolso interativo para consultar durante a apresentação.
    - **Notas Púlpito:** *"Experimente apertar [B] agora para apagar o telão e [B] novamente para restaurar!"*
  - **Slide 5 (`enquete-preferencia-transicao`):** *Votação de Estilo Visual*
    - **Enquete:** *"Qual transição visual você considera mais elegante para seus slides?"*
    - **Opções:** `A) Fade (Dissolvência Suave)`, `B) Zoom (Aproximação Cinematográfica)`, `C) Slide Horizontal (Deslizamento Clássico)`, `D) Slide Vertical (Fluxo Contínuo)`.

---

#### 4. 📦 `guia-criacao-studio-zip` — "Manual Prático: SlideMesh Studio — Criação, Importação & Portabilidade ZIP"
- **Público-Alvo:** Criadores de conteúdo, professores e quem precisa converter apresentações existentes.
- **Identidade Visual:** Primária `#f59e0b` (Amber Gold), Acento `#10b981` (Emerald), Fundo `#0c1017`, Transição `slide-horizontal` (350ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`studio-templates-prontos`):** *Criação em 1 Clique com 4 Templates Estruturados*
    - **Telão:** Os 4 modelos prontos do Studio (`import.html`): *Executivo & Pitch*, *Aula & Treinamento*, *Demonstração de Produto* e *Em Branco*.
    - **Celular:** Guia de quando utilizar cada template para economizar tempo de preparação.
    - **Asset SVG:** `studio-templates-overview.svg` (Cards ilustrados dos 4 modelos).
  - **Slide 2 (`estruturacao-split-screen`):** *Composição Visual & Split-Screen Automático*
    - **Telão:** Como o Studio divide automaticamente a tela em 2 colunas quando uma imagem SVG/PNG/JPG é associada ao slide.
    - **Celular:** Explicação de como os bullets do telão permanecem limpos enquanto o celular recebe parágrafos detalhados e tabelas.
    - **Notas Púlpito:** *"Mostre como o slide atual se beneficia da divisão em 2 colunas com o diagrama ao lado."*
  - **Slide 3 (`motor-importacao-multiformato`):** *Importação Semântica Universal*
    - **Telão:** Demonstração de conversão por drag-and-drop de arquivos `.pptx` (PowerPoint), `.docx` (Word), `.md` (Markdown), `.html` e `.pdf`.
    - **Celular:** Como o motor semântico extrai tópicos, notas de orador e mídias automaticamente.
    - **Asset SVG:** `import-pipeline.svg` (Fluxo de conversão multiformato em tempo real).
  - **Slide 4 (`portabilidade-zip-standalone`):** *Pacotes Portáteis `.slidemesh.zip`*
    - **Telão:** Como exportar um arquivo ZIP autocontido com manifest, slides e mídias pelo Portal, Studio ou CLI (`python3 tools/export_presentation.py`).
    - **Celular:** Como levar apresentações completas em um pendrive e rodar em qualquer máquina sem instalar dependências pesadas.
  - **Slide 5 (`enquete-formatos-favoritos`):** *Pesquisa de Formatos*
    - **Enquete:** *"Qual formato de arquivo você mais costuma converter para apresentações?"*
    - **Opções:** `A) PowerPoint (.pptx)`, `B) Documentos Word / Apostilas (.docx)`, `C) Anotações em Markdown (.md)`, `D) Criar do zero direto no Studio`.

---

#### 5. 💬 `guia-moderacao-e-analytics` — "Manual Prático: Mesa Técnica — Moderação de Q&A & Gestão de Enquetes"
- **Público-Alvo:** Moderadores, operadores de áudio/vídeo e produtores de palco.
- **Identidade Visual:** Primária `#06b6d4` (Cyan), Acento `#3b82f6` (Blue), Fundo `#0b1120`, Transição `fade` (350ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`mesa-tecnica-visao-geral`):** *O Console de Controle Invisível (`admin/index.html`)*
    - **Telão:** Como a Mesa Técnica gerencia o avanço de slides, temporizador e enquetes em tempo real sem poluir a projeção do palco.
    - **Celular:** Guia dos painéis do Admin (Status da Sessão, Fila de Perguntas, Controle de Mídias e Diagnóstico).
    - **Asset SVG:** `admin-console-layout.svg` (Layout e setores da Mesa Técnica).
  - **Slide 2 (`ciclo-moderacao-4-fases`):** *O Fluxo de Moderação de Perguntas em 4 Fases*
    - **Telão:** Ciclo de vida: *1. Pendente ➔ 2. Aprovada ➔ 3. Destaque no Telão (`M`) ➔ 4. Arquivada/Respondida*.
    - **Celular:** Instruções de como aprovar, rejeitar ou fixar perguntas com 1 clique na Mesa Técnica.
    - **Notas Púlpito:** *"Abra o mural com [M] para ver as perguntas aprovadas flutuando na tela."*
    - **Asset SVG:** `qa-moderation-lifecycle.svg` (Diagrama das 4 etapas de moderação).
  - **Slide 3 (`gestao-enquetes-tempo-real`):** *Controle de Enquetes & Revelação Animada*
    - **Telão:** Como o moderador abre a votação (`V`), acompanha a contagem de votos únicos e aperta `R` para revelar os gráficos animados no palco.
    - **Celular:** Demonstração do bloqueio de voto único por participante com feedback tátil no smartphone.
  - **Slide 4 (`analytics-historico-multisessao`):** *Relatórios Pós-Evento & Histórico*
    - **Telão:** Como exportar relatórios executivos em CSV, Markdown e JSON armazenados automaticamente em `sessions_archive/`.
    - **Celular:** Checklist de métricas essenciais pós-evento (Taxa de Participação, Distribuição de Votos e Dúvidas Frequentes).
  - **Slide 5 (`enquete-metricas-admin`):** *Métricas Críticas de Evento*
    - **Enquete:** *"Qual métrica pós-evento é mais valiosa para a sua equipe de produção?"*
    - **Opções:** `A) Taxa percentual de engajamento nas enquetes`, `B) Relatório completo de dúvidas enviadas`, `C) Registro consolidado em CSV para CRM`, `D) Histórico de tempo de permanência por slide`.

---

### 🛡️ TRILHA 3: INFRAESTRUTURA, SEGURANÇA & SUPORTE EM EVENTOS AO VIVO

#### 6. 🔒 `treinamento-interno-pin` — "Manual Prático: Segurança, PINs de Acesso & Gestão RBAC"
- **Público-Alvo:** Administradores de eventos corporativos, palestrantes com conteúdo restrito e gestores de TI.
- **Identidade Visual:** Primária `#10b981` (Emerald Shield), Acento `#6366f1` (Indigo Lock), Fundo `#0a1219`, Transição `slide-horizontal` (350ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`seguranca-acesso-pin`):** *Acesso Restrito na Prática (PIN 7482)*
    - **Telão:** *"Você acabou de desbloquear este guia digitando o PIN 7482 no seu celular!"* Explicação de como o Gatekeeper backend valida o código.
    - **Celular:** Demonstração da tela de bloqueio com dica customizada e liberação instantânea.
    - **Notas Púlpito:** *"Avise aos participantes que o PIN de acesso desta sessão é 7482."*
    - **Asset SVG:** `pin-gatekeeper-flow.svg` (Fluxo de validação de PIN no smartphone).
  - **Slide 2 (`setup-wizard-primeiro-uso`):** *Assistente de Primeiro Uso & CLI*
    - **Telão:** Como o sistema detecta a ausência de `config/security.json` e inicializa o assistente visual (`setup.html`) ou CLI (`python3 server.py --setup`) para criar o PIN mestre.
    - **Celular:** Boas práticas para nunca subir ambientes de evento com credenciais padrão (`security.example.json`).
  - **Slide 3 (`painel-seguranca-mesa-tecnica`):** *Gestão de Usuários RBAC no Admin*
    - **Telão:** Passo a passo do modal **`🔐 Segurança`** na Mesa Técnica: alterar PIN da mesa técnica, criar contas de palestrantes convidados e gerenciar participantes locais offline.
    - **Celular:** Tabela de permissões RBAC (`admin`, `presenter`, `audience`).
    - **Asset SVG:** `rbac-matrix.svg` (Matriz de papéis e privilégios).
  - **Slide 4 (`pacing-lock-controle-ritmo`):** *Trava de Ritmo de Slides (Pacing Lock)*
    - **Telão:** Como configurar o modo `lock_future` no manifest para impedir que o público veja slides adiante da explicação do palestrante.
    - **Celular:** Como ativar ou desativar a permissão de revisão de slides passados (`allowReviewPast: true/false`).
  - **Slide 5 (`quiz-seguranca-pratica`):** *Quiz de Segurança da Informação*
    - **Enquete:** *"Qual política de segurança você deve adotar para uma apresentação com dados estratégicos?"*
    - **Opções:** `A) Proteção por PIN de 4 dígitos informado no palco`, `B) Contas locais de palestrante com RBAC`, `C) Whitelist de domínio Google Workspace corporativo`, `D) Combinação de PIN no celular + Mesa Técnica autenticada`.

---

#### 7. 🩺 `guia-diagnostico-troubleshooting` — "Manual Prático: Diagnóstico de Rede, Monitoramento & Resolução de Falhas"
- **Público-Alvo:** Equipes de TI, técnicos de áudio/vídeo e operadores de palco em eventos ao vivo.
- **Identidade Visual:** Primária `#f43f5e` (Pulse Rose), Acento `#0ea5e9` (Tech Blue), Fundo `#0f0f17`, Transição `fade` (350ms).
- **Estrutura Detalhada (5 Slides):**
  - **Slide 1 (`telemetria-ao-vivo-admin`):** *O HUD de Diagnóstico da Mesa Técnica*
    - **Telão:** Como ler as métricas ao vivo no Admin: Latência RTT (ms), Taxa de Pacotes/s, Consumo de Banda (KB/s) e Badge de Saúde de Segurança (`🟢 Seg. Alta`, `🟡 Seg. Média`, `⚠️ PIN Padrão`).
    - **Celular:** Tabela com os limites saudáveis de rede local para eventos com 50 a 1.000 participantes.
    - **Asset SVG:** `diagnostics-hud-visual.svg` (Diagrama do painel de telemetria).
  - **Slide 2 (`operacao-lan-sem-internet`):** *Operação 100% Autônoma em Rede Local*
    - **Telão:** Como o servidor Python opera em um roteador Wi-Fi ou switch Ethernet sem depender de link externo de internet, com tripla redundância de sync.
    - **Celular:** Topologia de rede recomendada para eventos em hotéis, auditórios e centros de convenções.
    - **Asset SVG:** `offline-lan-topology.svg` (Topologia de rede local sem internet).
  - **Slide 3 (`resiliencia-reconexao-automatica`):** *Reconexão Automática & Anti-Spam*
    - **Telão:** O que acontece quando o sinal do celular oscila? O motor de snapshot recupera a sessão em sub-segundo.
    - **Celular:** Como o `SecurityGuard` impede spam com cooldown de 25s, limite de 3 perguntas pendentes e garantia de voto único.
  - **Slide 4 (`ajustes-projecao-emergencias`):** *Resolução de Falhas de Projeção no Palco*
    - **Telão:** Como resolver problemas com projetores: proporções 16:9 vs 4:3, modo tela cheia (`F`), emergência de palco com blackout (`B`) e inicialização em portas alternativas (`--port 8080`).
    - **Celular:** Guia de emergência rápida para o operador de palco.
    - **Notas Púlpito:** *"Lembre-se: em caso de imprevisto no palco, aperte [B] para focar a atenção em você."*
  - **Slide 5 (`enquete-troubleshooting-riscos`):** *Gestão de Riscos em Eventos*
    - **Enquete:** *"Qual o maior receio técnico que você costuma enfrentar em eventos ao vivo?"*
    - **Opções:** `A) Queda ou oscilação do sinal Wi-Fi`, `B) Resolução ou proporção cortada no projetor`, `C) Perguntas impróprias enviadas pela plateia`, `D) Lentidão ou travamento da apresentação`.

---

## 4. Fases de Implementação & Checklist de Entregas

### 🚀 Fase 1: Atualização do Catálogo & Arquitetura Visual dos 7 Guias
- [x] Atualizar [`presentations/catalog.json`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/catalog.json) registrando os 7 guias organizados pelas 3 trilhas com metadados completos, badges de segurança, contagem de slides e sessões padrão. *(Concluído com 100% de conformidade)*

### 🚀 Fase 2: Construção do Guia Onboarding (`comece-por-aqui`) e Expansão de Segurança (`treinamento-interno-pin`)
- [ ] Criar diretório [`presentations/comece-por-aqui/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/comece-por-aqui/) com `manifest.json`, `slides.json` (5 slides) e assets SVG de mapa do ecossistema.
- [ ] Expandir [`presentations/treinamento-interno-pin/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/treinamento-interno-pin/) de 1 para 5 slides completos com fluxo de PIN, RBAC, matriz de papéis e quiz.

### 🚀 Fase 3: Construção do Guia de Animações & Palco (`guia-animacoes-e-palco`) e Guia do Studio (`guia-criacao-studio-zip`)
- [ ] Criar diretório [`presentations/guia-animacoes-e-palco/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-animacoes-e-palco/) com `manifest.json`, `slides.json` (5 slides), assets SVG de transições e pré-cache de mídia.
- [ ] Criar diretório [`presentations/guia-criacao-studio-zip/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-criacao-studio-zip/) com `manifest.json`, `slides.json` (5 slides), assets SVG de templates e pipeline de importação.

### 🚀 Fase 4: Construção do Guia de Moderação (`guia-moderacao-e-analytics`) e Guia de Diagnóstico & Troubleshooting (`guia-diagnostico-troubleshooting`)
- [ ] Criar diretório [`presentations/guia-moderacao-e-analytics/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-moderacao-e-analytics/) com `manifest.json`, `slides.json` (5 slides) e assets SVG do ciclo de moderação de Q&A e relatórios.
- [ ] Criar diretório [`presentations/guia-diagnostico-troubleshooting/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-diagnostico-troubleshooting/) com `manifest.json`, `slides.json` (5 slides) e assets SVG de telemetria e topologia LAN.

### 🚀 Fase 5: Homologação Completa da Suíte & Atualização da Documentação Oficial
- [ ] Executar bateria completa de testes automatizados (`python3 tests/test_suite.py` e `npm test`) garantindo 100% de aprovação em todas as suítes e integridade dos 7 decks.
- [ ] Atualizar [`README.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.md) e [`README.pt-BR.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.pt-BR.md) documentando as 3 Trilhas de Conhecimento e a tabela com os 7 Manuais Vivos disponíveis no repositório.

---

## 5. Matriz de Arquivos a Serem Criados/Atualizados

| Arquivo / Diretório | Ação | Responsabilidade |
|---|:---:|---|
| [`presentations/catalog.json`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/catalog.json) | Modificar | Registro oficial consolidado dos 7 Manuais Vivos. |
| [`presentations/comece-por-aqui/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/comece-por-aqui/) | Criar | Guia de Onboarding & Mapa das 5 Interfaces Web (5 slides). |
| [`presentations/slidemesh-showcase/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/slidemesh-showcase/) | Manter/Revisar | Showcase Geral Oficial & Tour da Plataforma (10 slides). |
| [`presentations/guia-animacoes-e-palco/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-animacoes-e-palco/) | Criar | Manual de Transições, Efeitos Canvas 2D & Mídia HTTP 206 (5 slides). |
| [`presentations/guia-criacao-studio-zip/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-criacao-studio-zip/) | Criar | Manual do Studio, Templates, Importação & Pacotes ZIP (5 slides). |
| [`presentations/guia-moderacao-e-analytics/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-moderacao-e-analytics/) | Criar | Manual da Mesa Técnica, Moderação Q&A & Relatórios (5 slides). |
| [`presentations/treinamento-interno-pin/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/treinamento-interno-pin/) | Expandir | Manual de Segurança, PIN 7482, Pacing & RBAC (5 slides). |
| [`presentations/guia-diagnostico-troubleshooting/`](file:///home/flashbsb/projetos/SlideMeshLive/presentations/guia-diagnostico-troubleshooting/) | Criar | Manual de Diagnóstico de Rede, Telemetria & Troubleshooting (5 slides). |
| [`tests/test_suite.py`](file:///home/flashbsb/projetos/SlideMeshLive/tests/test_suite.py) | Validar | Certificação de integridade estrutural e funcional de todas as suítes. |
| [`README.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.md) & [`README.pt-BR.md`](file:///home/flashbsb/projetos/SlideMeshLive/README.pt-BR.md) | Modificar | Documentação completa das 3 trilhas e dos 7 manuais vivos. |
