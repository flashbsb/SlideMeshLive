# SlideMeshLive — Plataforma de Apresentação HTML Interativa Sincronizada

<div align="center">

[![English](https://img.shields.io/badge/Documentation-English-blue.svg)](./README.md)
[![Português](https://img.shields.io/badge/Documentação-Português-green.svg)](./README.pt-BR.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)](https://python.org)

**[🇺🇸 Read in English](./README.md)** &nbsp;|&nbsp; **[🇧🇷 Leia em Português](./README.pt-BR.md)**

</div>

> **Plataforma web de apresentações em tempo real** desacoplada e multi-apresentação, composta pelo **Painel do Apresentador** (telão com bullets limpos, notas e moderação) e a **Interface do Público** (smartphones com conteúdo aprofundado, enquetes ao vivo, voto único garantido e moderação de perguntas).

---

## 1. Visão Geral da Arquitetura

A plataforma segue uma arquitetura modular baseada em tecnologias web nativas (**HTML5, CSS3 Vanilla e JavaScript ES Modules**) com backend em Python local de alta performance (`server.py`) ou nuvem sobre **Firebase** (Hosting, Authentication e Realtime Database), contando com tripla redundância de sincronização local (Hub HTTP Sequencial + BroadcastChannel + Storage Event) com latência inferior a 50ms.

```text
                         APRESENTADOR (Telão / Notebook)
                                      │
                         ┌────────────┴────────────┐
                         │    Presenter Engine     │
                         │                         │
                         │ • Slide Sintético       │
                         │ • Notas do Orador       │
                         │ • Controle de Enquetes  │
                         │ • Fila de Moderação     │
                         │ • QR Code Dinâmico      │
                         └────────────┬────────────┘
                                      │
                   Sincronização em Tempo Real (Bidirecional)
                   Hub Python (/api/sync) / BroadcastChannel
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
    📱 Participante 1         📱 Participante 2         📱 Participante N
   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │ • Conteúdo Livre │      │ • Conteúdo Livre │      │ • Conteúdo Livre │
   │ • Tabelas/Textos │      │ • Tabelas/Textos │      │ • Tabelas/Textos │
   │ • Google Login   │      │ • Google Login   │      │ • Google Login   │
   │ • Voto Único     │      │ • Voto Único     │      │ • Voto Único     │
   │ • Fazer Pergunta │      │ • Fazer Pergunta │      │ • Fazer Pergunta │
   └──────────────────┘      └──────────────────┘      └──────────────────┘
```

---

## 2. Princípios de Negócio & Segurança

1. **Leitura Livre vs Interação Autenticada**:
   - O público pode navegar e ler todos os slides, resumos, tabelas e diagramas **sem necessidade de login**.
   - Para qualquer ação que altere dados (votar em enquetes ou enviar perguntas), é solicitada autenticação segura com Google ou identificação de participante.
2. **Privacidade e Anonimato Garantidos**:
   - O apresentador e os demais participantes **não visualizam e-mail ou nome real**.
   - O sistema gera internamente um alias anônimo para exibição pública (ex: `Participante #83`).
3. **Garantia de Voto Único**:
   - Cada participante autenticado só pode votar **uma única vez** por enquete. A trava é aplicada atomicamente no cliente e no servidor.
4. **Fila de Moderação em Tempo Real**:
   - Perguntas enviadas entram em uma fila moderada na mesa técnica (`Pendentes`, `Aprovadas`, `Respondidas`, `Destaque`).
   - O apresentador pode **destacar qualquer pergunta no telão principal** com animação flutuante.
5. **Rate Limiting & Anti-Abuso**:
   - Cooldown de 25s entre perguntas e limite de até 3 perguntas pendentes acumuladas por participante.
   - Apresentador pode bloquear participantes abusivos com um clique.
6. **Controle e Encerramento de Sessão**:
   - Ao encerrar a sessão pelo botão `[ 🛑 Encerrar ]`, a apresentação é finalizada e novos votos ou perguntas são bloqueados.

---

## 3. Estrutura do Projeto

```text
SlideMeshLive/
├── index.html                               # Portal / Catálogo de Apresentações
├── import.html                              # SlideMesh Studio (Criação, Importação e Edição)
├── docs.html                                # Visualizador Dinâmico de Documentação Markdown
├── server.py                                # Servidor Local em Python com Hub HTTP Sequencial
├── README.md                                # Documentação oficial em Inglês
├── README.pt-BR.md                          # Documentação oficial em Português
│
├── css/                                     # Design System Modular
│   ├── base.css                             # Tokens HSL, tipografia Inter/Mono, temas visuais
│   ├── animations.css                       # Animações de transição, pulso e fade
│   ├── components.css                       # Botões, modais, gráficos de votação, badges
│   ├── presenter.css                        # Layout da tela do apresentador e dock
│   └── audience.css                         # Layout mobile-first do smartphone
│
├── js/                                      # Módulos JavaScript (ES Modules)
│   ├── config.js                            # Configurações gerais e credenciais Firebase
│   ├── core/                                # Motores Centrais
│   │   ├── presentation-engine.js           # Carregador e renderizador dinâmico de slides
│   │   ├── realtime-engine.js               # Sincronização em tempo real (Hub LAN + Local)
│   │   ├── conversion-engine.js             # Motor semântico PPTX/DOCX/MD/PDF e Templates
│   │   ├── i18n-engine.js                   # Internacionalização simétrica (pt-BR / en-US)
│   │   ├── theme-engine.js                  # Motor de temas (Dark, Light, Slate, High Contrast)
│   │   ├── session-manager.js               # Gestor de snapshots e exportação CSV/MD
│   │   ├── auth-engine.js                   # Identidade segura de participante
│   │   ├── interaction-engine.js            # Enquetes, voto único e apuração de resultados
│   │   ├── moderation-engine.js             # Fila de moderação de perguntas e destaque
│   │   ├── security-guard.js                # Rate limiting, bloqueio e regras de sessão
│   │   └── qr-engine.js                     # Geração de URLs de sessão e QR Code
│   ├── presenter/
│   │   └── presenter-app.js                 # Controlador da aplicação do Apresentador
│   └── audience/
│       └── audience-app.js                  # Controlador da aplicação Mobile do Público
│
├── presenter/                               # Ambiente do Telão / Apresentador
│   └── index.html                           # Tela do Telão + Painel de Atalhos
│
├── admin/                                   # Ambiente do Moderador / Mesa Técnica
│   └── index.html                           # Console de Moderação, Votações e Controle
│
├── audience/                                # Ambiente do Público
│   └── index.html                           # Interface Mobile para Smartphones
│
├── presentations/                           # Diretório de Apresentações
│   ├── catalog.json                         # Registro central de apresentações disponíveis
│   ├── slidemesh-showcase/                  # Apresentação Demonstrativa
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

O terminal exibirá os endereços locais e de rede Wi-Fi para conexão:
- **Portal Inicial:** `http://localhost:8000/`
- **SlideMesh Studio:** `http://localhost:8000/import.html`
- **Telão Apresentador:** `http://localhost:8000/presenter/?presentation=slidemesh-showcase`
- **Mesa Técnica / Admin:** `http://localhost:8000/admin/?presentation=slidemesh-showcase`
- **Celular do Público:** `http://<IP_DO_SEU_COMPUTADOR>:8000/audience/?presentation=slidemesh-showcase`

---

## 5. SlideMesh Studio — Criação, Importação e Edição Web

O **SlideMeshLive** conta com o **SlideMesh Studio**, uma suíte integrada de autoria visual acessível pelo portal inicial ou diretamente em [`import.html`](http://localhost:8000/import.html):

### 5.1 Criar Nova Apresentação do Zero (com Templates)
1. No portal inicial, clique em **`✨ Criar Nova`** (ou abra `import.html?mode=new`).
2. Escolha entre 4 templates estruturados:
   - **👔 Executivo & Pitch:** 5 slides com Capa, Desafio, Solução, Enquete de Validação e Próximos Passos.
   - **🎓 Aula & Treinamento:** 4 slides com Objetivos, Arquitetura Conceitual, Quiz ao Vivo e Resumo de Estudo.
   - **🚀 Demonstração de Produto:** 4 slides com Visão Geral, Recursos Inovadores, Votação e Encerramento.
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
| `→` / `Espaço` | **Próximo Slide** | Avança para o próximo slide |
| `←` | **Slide Anterior** | Retorna ao slide anterior |
| `V` | **Alternar Votação** | Abre/fecha a votação da enquete |
| `R` | **Revelar Resultados** | Mostra/oculta o gráfico de votos no telão |
| `Z` | **Zerar Votos** | Reinicia os votos da enquete atual |
| `Q` | **QR Code Gigante** | Exibe o QR Code em tela cheia para a plateia |
| `M` | **Mural de Perguntas** | Abre o mural flutuante de perguntas moderadas |
| `P` | **Modo Púlpito** | Exibe as notas privadas do orador |
| `F` | **Tela Cheia** | Alterna o modo tela cheia do navegador |

---

## 7. Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
