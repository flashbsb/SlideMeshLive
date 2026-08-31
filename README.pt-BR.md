# SlideMeshLive — Plataforma de Apresentação HTML Interativa Sincronizada

<div align="center">

[![English](https://img.shields.io/badge/Documentation-English-blue.svg)](./README.md)
[![Português](https://img.shields.io/badge/Documentação-Português-green.svg)](./README.pt-BR.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)](https://python.org)

**[🇺🇸 Read in English](./README.md)** &nbsp;|&nbsp; **[🇧🇷 Leia em Português](./README.pt-BR.md)**

</div>

> **Plataforma web de apresentações em tempo real** desacoplada e multi-apresentação, composta pelo **Painel do Apresentador** (telão com bullets limpos, modo split-screen, notas e moderação), **Mesa Técnica / Admin** (controle remoto, moderação de perguntas e exportação de relatórios) e a **Interface do Público** (smartphones com conteúdo aprofundado, enquetes ao vivo, voto único garantido e feedback tátil).

---

## 1. Visão Geral da Arquitetura

O **SlideMeshLive** foi concebido com uma arquitetura modular baseada em tecnologias web nativas (**HTML5, CSS3 Vanilla e JavaScript ES Modules**) e um servidor local de alta performance em Python (`server.py`) com tripla redundância de sincronização (Hub HTTP Sequencial + BroadcastChannel + Storage Event) para latência inferior a 50ms na rede local (LAN / Wi-Fi), dispensando conexão com a internet ou servidores externos.

```text
                       APRESENTADOR (Telão / Notebook)
                                      │
                         ┌────────────┴────────────┐
                         │    Presenter Engine     │
                         │                         │
                         │ • Slide Clean & Split   │
                         │ • Modo Púlpito & Timer  │
                         │ • Controle de Enquetes  │
                         │ • Mural de Perguntas    │
                         │ • QR Code Dinâmico      │
                         └────────────┬────────────┘
                                      │
                   Sincronização em Tempo Real (Bidirecional)
                   Hub Python (/api/sync) / BroadcastChannel
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
    🛡️ Mesa Técnica (Admin)   📱 Smartphone 1           📱 Smartphone N
   ┌──────────────────────┐  ┌──────────────────┐      ┌──────────────────┐
   │ • Navegação Remota   │  │ • Leitura Livre  │      │ • Leitura Livre  │
   │ • Moderação 4 Fases  │  │ • Resumo & Texto │      │ • Resumo & Texto │
   │ • Ajuste Host QR     │  │ • Voto Único     │      │ • Voto Único     │
   │ • Exportação CSV/MD  │  │ • Fazer Pergunta │      │ • Fazer Pergunta │
   │ • Projeção Analytics │  │ • Feedback Tátil │      │ • Feedback Tátil │
   └──────────────────────┘  └──────────────────┘      └──────────────────┘
```

---

## 2. Princípios de Negócio & Segurança

1. **Operação 100% Autônoma Offline (Rede Local / Wi-Fi)**:
   - A plataforma opera perfeitamente sem internet. O servidor Python local gerencia presenças, votos, enquetes e perguntas na rede local.
2. **Leitura Livre vs. Interação com Identidade Segura**:
   - O público navega e lê todos os slides, resumos, tabelas e diagramas **sem necessidade de cadastro ou login externo**.
   - Para interações que alteram estado (votar em enquetes ou enviar perguntas), o sistema utiliza identidade de participante com trava criptográfica de voto único.
3. **Privacidade e Anonimato Garantidos**:
   - O apresentador e a plateia **não visualizam dados pessoais ou e-mails**.
   - O sistema gera internamente um alias público amigável (ex: `Participante #83`).
4. **Garantia Rigorosa de Voto Único**:
   - Cada participante autenticado só pode votar **uma única vez** por enquete, com validação atômica no cliente e no servidor.
5. **Mesa Técnica e Moderação em 4 Fases**:
   - Perguntas do público passam pelo fluxo de moderação: `Pendentes` ➔ `Aprovadas` ➔ `Em Destaque` ➔ `Respondidas`.
   - O moderador ou apresentador pode **destacar qualquer pergunta no telão principal** com animação flutuante.
6. **Rate Limiting & Proteção Anti-Abuso (SecurityGuard)**:
   - Cooldown de 25s entre perguntas e limite de até 3 perguntas pendentes acumuladas por participante.
   - A mesa técnica pode suspender participantes abusivos em 1 clique.
7. **Resiliência e Snapshot de Estado em Disco**:
   - O servidor Python grava snapshots atômicos (`snapshot_state.json`), preservando votos e perguntas em caso de reinicialização.
8. **Exportação de Dados e Relatório Executivo**:
   - A mesa técnica exporta relatórios completos de participação em formatos **CSV estruturado** e **Markdown executivo**.

---

## 3. Estrutura do Projeto

```text
SlideMeshLive/
├── index.html                               # Portal Inicial / Catálogo de Apresentações
├── import.html                              # SlideMesh Studio (Criação, Importação e Edição)
├── docs.html                                # Visualizador Dinâmico de Documentação Markdown
├── server.py                                # Servidor Local em Python com Hub HTTP Sequencial
├── README.md                                # Documentação Oficial (Inglês)
├── README.pt-BR.md                          # Documentação Oficial (Português)
│
├── css/                                     # Design System Modular
│   ├── base.css                             # Tokens HSL, tipografia Inter/Mono, 4 temas visuais
│   ├── animations.css                       # Animações de transição, pulso, floating e fade
│   ├── components.css                       # Botões, modais, gráficos de votação, badges, drawer
│   ├── presenter.css                        # Layout da tela do apresentador, split-screen e dock
│   ├── audience.css                         # Layout mobile-first do smartphone com haptics
│   └── admin.css                            # Layout da Mesa Técnica / Console de Moderação
│
├── js/                                      # Módulos JavaScript (ES Modules)
│   ├── config.js                            # Configurações de ambiente e credenciais
│   ├── core/                                # Motores Centrais
│   │   ├── presentation-engine.js           # Carregador e renderizador dinâmico de slides
│   │   ├── realtime-engine.js               # Sincronização em tempo real (Hub LAN + Local)
│   │   ├── conversion-engine.js             # Motor semântico PPTX/DOCX/MD/PDF e Templates
│   │   ├── i18n-engine.js                   # Internacionalização simétrica (pt-BR / en-US)
│   │   ├── theme-engine.js                  # Motor de temas (Dark, Light, Slate, High Contrast)
│   │   ├── session-manager.js               # Gestor de snapshots e exportação CSV/MD
│   │   ├── auth-engine.js                   # Identidade segura de participante
│   │   ├── interaction-engine.js            # Enquetes, voto único e apuração de resultados
│   │   ├── moderation-engine.js             # Fila de moderação de perguntas e destaque no telão
│   │   ├── security-guard.js                # Rate limiting, bloqueio e regras de encerramento
│   │   └── qr-engine.js                     # Geração de URLs de sessão e QR Code
│   ├── presenter/
│   │   └── presenter-app.js                 # Controlador da aplicação do Apresentador
│   ├── audience/
│   │   └── audience-app.js                  # Controlador da aplicação Mobile do Público
│   └── admin/
│       └── admin-app.js                     # Controlador da Mesa Técnica / Moderador
│
├── presenter/                               # Ambiente do Telão / Apresentador
│   └── index.html                           # Tela do Telão + Painel de Atalhos
│
├── admin/                                   # Ambiente do Moderador / Mesa Técnica
│   └── index.html                           # Console de Moderação, Votações e Controle Remoto
│
├── audience/                                # Ambiente do Público
│   └── index.html                           # Interface Mobile para Smartphones
│
├── presentations/                           # Diretório de Apresentações
│   ├── catalog.json                         # Registro central de apresentações disponíveis
│   ├── slidemesh-showcase/                  # Apresentação Demonstrativa Oficial
│   └── treinamento-interno-pin/             # Demonstração Protegida por PIN
│
└── tools/                                   # Utilitários CLI
    └── import_presentation.py               # Importador CLI para automação de apresentações
```

---

## 4. Como Executar Localmente

### 4.1 Pré-requisitos
- Python 3.8 ou superior instalado.
- Navegador moderno (Chrome, Edge, Firefox, Safari).

### 4.2 Inicialização com 1 Comando
Execute o servidor no diretório do projeto:

```bash
cd /home/flashbsb/projetos/SlideMeshLive
python3 server.py
```

O terminal exibirá os links de acesso local e na rede Wi-Fi:
- **Portal Inicial:** `http://localhost:8000/`
- **SlideMesh Studio:** `http://localhost:8000/import.html`
- **Telão Apresentador:** `http://localhost:8000/presenter/?presentation=slidemesh-showcase&session=SHOWCASE2026`
- **Mesa Técnica / Admin:** `http://localhost:8000/admin/?presentation=slidemesh-showcase&session=SHOWCASE2026`
- **Celular do Público:** `http://<IP_DO_SEU_COMPUTADOR>:8000/audience/?presentation=slidemesh-showcase&session=SHOWCASE2026`

---

## 5. SlideMesh Studio — Criação, Importação e Edição Web

O **SlideMesh Studio** (`import.html`) é uma suíte integrada de autoria visual acessível pelo portal inicial:

### 5.1 Criar Nova Apresentação do Zero (com Templates)
1. No portal inicial, clique em **`✨ Criar Nova`** (ou abra `import.html?mode=new`).
2. Escolha entre 4 templates estruturados:
   - **👔 Executivo & Pitch:** 5 slides (Capa, Desafio, Solução, Enquete de Validação e Próximos Passos).
   - **🎓 Aula & Treinamento:** 4 slides (Objetivos, Arquitetura Conceitual, Quiz ao Vivo e Resumo de Estudo).
   - **🚀 Demonstração de Produto:** 4 slides (Visão Geral, Recursos Inovadores, Votação e Encerramento).
   - **📄 Em Branco:** 1 slide limpo para liberdade total de escrita.
3. Edite os títulos, bullets, notas de orador, resumo e seções de leitura no smartphone em tempo real com auto-save em `localStorage`.
4. Adicione imagens nos slides para habilitar o modo **Split-Screen (2 colunas)** no Telão.
5. Clique em **`🚀 Publicar Apresentação`**.

### 5.2 Editar Apresentações Existentes
1. No portal inicial, localize a apresentação no catálogo e clique no botão **`✏️ Editar`**.
2. O Studio carrega automaticamente todos os slides, enquetes e notas da apresentação.
3. Altere qualquer texto, adicione novos slides, reordene a sequência (`🔼` / `🔽`), desmarque slides (`☑️`) ou converta slides em enquetes (`⚡`).
4. Clique em **`💾 Salvar Alterações`** para sobrescrever os arquivos no servidor de forma atômica e segura.

### 5.3 Importar Arquivos e Apresentações Externas
1. No Studio, acesse a aba **`📁 Importar Arquivo`**.
2. Arraste e solte o arquivo desejado (**PowerPoint `.pptx`**, **Word `.docx`**, **Markdown `.md`**, **HTML `.html`** ou **PDF `.pdf`**).
3. O motor semântico extrai automaticamente títulos, tópicos, notas de orador e ilustrações.
4. Revise no editor lado a lado e publique em 1 clique.

### 5.4 Utilitário de Linha de Comando (CLI)
Você também pode importar apresentações e documentos diretamente pelo terminal:
```bash
# Importar apresentação do PowerPoint (.pptx)
python3 tools/import_presentation.py minhas_palestras/arquitetura.pptx --title "Arquitetura Cloud"

# Importar apostila ou documento do Word (.docx)
python3 tools/import_presentation.py docs/apostila.docx --title "Apostila de Redes"

# Importar notas em Markdown (.md) com código de sessão e proteção por PIN
python3 tools/import_presentation.py notas.md --session LIVE2026 --security pin
```

---

## 6. Atalhos de Teclado no Telão do Apresentador

| Tecla | Ação | Descrição |
| :--- | :--- | :--- |
| `→` / `Espaço` / `PageDown` | **Próximo Slide** | Avança para o próximo slide |
| `←` / `PageUp` | **Slide Anterior** | Retorna ao slide anterior |
| `F` | **Tela Cheia** | Alterna o modo tela cheia do navegador |
| `P` | **Modo Púlpito** | Exibe as notas privadas do orador e timer de palco |
| `Q` | **QR Code Gigante** | Exibe o QR Code em tela cheia central para a plateia |
| `W` | **Alternar Mini QR** | Oculta/exibe o mini QR Code no rodapé da projeção |
| `M` | **Mural de Perguntas** | Abre o mural flutuante de perguntas moderadas |
| `V` | **Alternar Votação** | Abre/fecha a votação da enquete no slide atual |
| `R` | **Revelar Resultados** | Mostra/oculta o gráfico animado de votos no telão |
| `B` | **Modo Blackout** | Escurece a tela para direcionar o foco total ao palestrante |
| `Esc` | **Fechar Modais** | Fecha o mural de perguntas ou o QR Code gigante |

---

## 7. Design System & Acessibilidade

- **4 Temas Visuais Modernos:** `Dark` (Padrão), `Light`, `Slate` e `High Contrast` (WCAG 2.2 AAA).
- **Feedback Tátil (Haptics):** Suporte a `navigator.vibrate` ao votar e enviar perguntas pelo smartphone.
- **Tipografia Otimizada:** Fontes `Inter` para legibilidade de texto e `JetBrains Mono` para códigos e números.
- **Simetria i18n:** Suporte completo e instantâneo a **Português (pt-BR)** e **Inglês (en-US)**.

---

## 8. Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
