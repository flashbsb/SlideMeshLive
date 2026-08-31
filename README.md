# Plataforma de Apresentação HTML Interativa Sincronizada

> **Plataforma web de apresentações em tempo real** desacoplada e multi-apresentação, composta pelo **Painel do Apresentador** (telão com bullets limpos, notas e moderação) e a **Interface do Público** (smartphones com conteúdo aprofundado, enquetes ao vivo, voto único garantido e moderação de perguntas).

---

## 1. Visão Geral da Arquitetura

A plataforma segue uma arquitetura modular baseada em tecnologias web nativas (**HTML5, CSS3 Vanilla e JavaScript ES Modules**) com backend em nuvem sobre **Firebase** (Hosting, Authentication e Realtime Database) e tripla redundância de sincronização local (BroadcastChannel + Storage Event + Polling) para testes instantâneos.

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
                   Firebase Realtime DB / Local Broadcast
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
   - Para qualquer ação que altere dados (votar em enquetes ou enviar perguntas), é solicitada autenticação segura com Google.
2. **Privacidade e Anonimato Garantidos**:
   - O apresentador e os demais participantes **não visualizam e-mail ou nome real**.
   - O sistema gera internamente um alias anônimo para exibição pública (ex: `Participante #83`).
3. **Garantia de Voto Único**:
   - Cada participante autenticado só pode votar **uma única vez** por enquete. A trava é aplicada no cliente e nas regras de segurança do Realtime Database (`/sessions/$sessionId/votes/$pollId/$uid`).
4. **Fila de Moderação em Tempo Real**:
   - Perguntas enviadas entram em uma fila moderada pelo apresentador (`Pendentes`, `Aprovadas`, `Rejeitadas`).
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
├── firebase.json                            # Configuração de Firebase Hosting e Database
├── database.rules.json                      # Regras de segurança do Realtime Database
├── README.md                                # Documentação completa do projeto
│
├── css/                                     # Design System Modular
│   ├── base.css                             # Tokens HSL, tipografia Inter/Mono, glassmorphism
│   ├── animations.css                       # Animações de transição, pulso e fade
│   ├── components.css                       # Botões, modais, gráficos de votação, badges, drawer
│   ├── presenter.css                        # Layout da tela do apresentador e dock
│   └── audience.css                         # Layout mobile-first do smartphone
│
├── js/                                      # Módulos JavaScript (ES Modules)
│   ├── config.js                            # Configurações gerais e credenciais Firebase
│   ├── core/                                # Motores Centrais
│   │   ├── presentation-engine.js           # Carregador e renderizador dinâmico de slides
│   │   ├── realtime-engine.js               # Sincronização em tempo real (Firebase + Local)
│   │   ├── auth-engine.js                   # Autenticação Google + Identidade anônima
│   │   ├── interaction-engine.js            # Enquetes, voto único e apuração de resultados
│   │   ├── moderation-engine.js             # Fila de moderação de perguntas e destaque no telão
│   │   ├── security-guard.js                # Rate limiting, bloqueio e regras de encerramento
│   │   └── qr-engine.js                     # Geração de URLs de sessão e QR Code
│   ├── presenter/
│   │   └── presenter-app.js                 # Controlador da aplicação do Apresentador
│   └── audience/
│       └── audience-app.js                  # Controlador da aplicação Mobile do Público
│
├── presenter/                               # Ambiente do Apresentador
│   └── index.html                           # Tela do Telão + Painel de Comando
│
├── admin/                                   # Ambiente do Moderador / Mesa Técnica
│   └── index.html                           # Console de Moderação, Votações e Controle Remoto
│
├── audience/                                # Ambiente do Público
│   └── index.html                           # Interface Mobile para Smartphones
│
├── presentations/                           # Catálogo de Apresentações Modulares
│   └── sdwan-cpe-unificado/                 # Apresentação Piloto baseada no NTP SD-WAN
│       ├── manifest.json                    # Metadados da apresentação
│       └── slides.json                      # Conteúdo detalhado dos slides e enquetes
│
└── lib/                                     # Bibliotecas leves
    └── qrcode.min.js                        # Gerador de QR Code client-side
```

---

## 4. Como Executar Localmente

Você pode rodar a plataforma imediatamente com qualquer servidor HTTP estático:

```bash
# Navegue até o diretório do projeto
cd /home/flashbsb/projetos/SlideMeshLive

# Inicie o servidor local na porta 8000
python3 -m http.server 8000
```

Acesse no navegador:
- **Portal de Apresentações**: [http://localhost:8000/](http://localhost:8000/)
- **Painel do Apresentador**: [http://localhost:8000/presenter/?presentation=sdwan-cpe-unificado&session=SDWAN2026](http://localhost:8000/presenter/?presentation=sdwan-cpe-unificado&session=SDWAN2026)
- **Interface do Smartphone**: [http://localhost:8000/audience/?presentation=sdwan-cpe-unificado&session=SDWAN2026](http://localhost:8000/audience/?presentation=sdwan-cpe-unificado&session=SDWAN2026)

> **Dica para Teste em Tempo Real**: Abra o Apresentador em uma janela e o Smartphone em outra janela lado a lado. Ao avançar o slide no Apresentador (`→`), o smartphone atualizará automaticamente!

---

## 5. Como Configurar o Firebase para Produção

Para utilizar a sincronização global pela internet entre múltiplos dispositivos remotos e login real com contas Google:

### 5.1 Criar o Projeto no Firebase Console
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. Ative o **Firebase Authentication**:
   - Vá em *Authentication* ➔ *Sign-in method*.
   - Habilite o provedor **Google**.
3. Ative o **Realtime Database**:
   - Vá em *Realtime Database* ➔ *Criar Banco de Dados*.
   - Selecione a região mais próxima (ex: `us-central1`).
4. Copie as regras de segurança:
   - Cole o conteúdo do arquivo [database.rules.json](file:///home/flashbsb/projetos/SlideMeshLive/database.rules.json) na aba *Rules* do Realtime Database.

### 5.2 Configurar as Credenciais no Projeto
Edite o arquivo [js/config.js](file:///home/flashbsb/projetos/SlideMeshLive/js/config.js) e insira as chaves do seu projeto:

```javascript
export const APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSy...",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
  }
};
```

### 5.3 Publicar no Firebase Hosting
Com a CLI do Firebase instalada:

```bash
# Login no Firebase
firebase login

# Publicação da aplicação
firebase deploy
```

---

## 6. SlideMesh Studio — Criação, Importação e Edição Web

O **SlideMeshLive** conta com o **SlideMesh Studio**, uma suíte integrada de autoria visual acessível pelo portal inicial ou diretamente em [`import.html`](http://localhost:8000/import.html):

### 6.1 Criar Nova Apresentação do Zero (com Templates)
1. No portal inicial, clique em **`✨ Criar Nova`** (ou abra `import.html?mode=new`).
2. Escolha entre 4 templates estruturados:
   - **👔 Executivo & Pitch:** 5 slides com Capa, Desafio, Solução, Enquete de Validação e Próximos Passos.
   - **🎓 Aula & Treinamento:** 4 slides com Objetivos, Arquitetura Conceitual, Quiz ao Vivo e Resumo de Estudo.
   - **🚀 Demonstração de Produto:** 4 slides com Visão Geral, Recursos Inovadores, Votação e Encerramento.
   - **📄 Em Branco:** 1 slide limpo para liberdade total de escrita.
3. Edite os títulos, bullets, notas de orador, resumo e seções de leitura no smartphone em tempo real com auto-save em `localStorage`.
4. Adicione imagens nos slides para habilitar o modo **Split-Screen (2 colunas)** no Telão.
5. Clique em **`🚀 Publicar Apresentação`**.

### 6.2 Editar Apresentações Existentes
1. No portal inicial, localize a apresentação no catálogo e clique no botão **`✏️ Editar`**.
2. O Studio carrega automaticamente todos os slides, enquetes e notas da apresentação.
3. Altere qualquer texto, adicione novos slides, reordene a sequência (`🔼` / `🔽`), desmarque slides (`☑️`) ou converta slides em enquetes (`⚡`).
4. Clique em **`💾 Salvar Alterações`** para sobrescrever os arquivos no servidor de forma atômica e segura.

### 6.3 Importar Arquivos e Apresentações Externas
1. No Studio, acesse a aba **`📁 Importar Arquivo`**.
2. Arraste e solte o arquivo desejado (**PowerPoint `.pptx`**, **Word `.docx`**, **Markdown `.md`**, **HTML `.html`** ou **PDF `.pdf`**).
3. O motor semântico extrai automaticamente títulos, tópicos, notas de orador e ilustrações.
4. Revise no editor lado a lado e publique em 1 clique.

### 6.4 Utilitário de Linha de Comando (CLI)
Você também pode importar apresentações e documentos diretamente pelo terminal:
```bash
# Importar apresentação do PowerPoint (.pptx)
python3 tools/import_presentation.py minhas_palestras/arquitetura.pptx --title "Arquitetura Cloud"

# Importar apostila ou documento do Word (.docx)
python3 tools/import_presentation.py docs/apostila.docx --title "Apostila de Redes"

# Importar notas em Markdown (.md) com código de sessão e proteção por PIN
python3 tools/import_presentation.py notas.md --session LIVE2026 --security pin
```

### Opção C: Estrutura Manual JSON
Para criar manualmente via arquivos de configuração:
1. Crie uma nova pasta em `presentations/<id-da-apresentacao>/`.
2. Adicione o arquivo `manifest.json`:
   ```json
   {
     "id": "minha-apresentacao",
     "title": "Título da Apresentação",
     "subtitle": "Subtítulo Corporativo",
     "defaultSession": "SES2026",
     "version": "1.0.0"
   }
   ```
3. Adicione o arquivo `slides.json`:
   ```json
   {
     "presentationId": "minha-apresentacao",
     "slides": [
       {
         "id": 1,
         "title": "Nome do Slide",
         "presenter": {
           "headline": "Título do Telão",
           "bullets": ["Ponto 1", "Ponto 2"],
           "notes": "Notas do orador visíveis apenas no painel."
         },
         "audience": {
           "summary": "Resumo aprofundado para o smartphone.",
           "sections": [
             {
               "title": "Detalhes",
               "type": "text",
               "content": "Texto explicativo..."
             }
           ]
         },
         "interaction": {
           "poll": {
             "id": "poll-1",
             "question": "Pergunta da Enquete?",
             "options": [
               { "id": "A", "text": "Opção A" },
               { "id": "B", "text": "Opção B" }
             ]
           }
         }
       }
     ]
   }
   ```
4. Acesse diretamente via URL:  
   `http://dominio.com/presenter/?presentation=minha-apresentacao&session=MINHASESSAO`

---

## 7. Atalhos de Teclado no Telão do Apresentador

| Tecla | Ação |
| :--- | :--- |
| **`→`** / **`Espaço`** / **`PageDown`** | Avançar para o próximo slide |
| **`←`** / **`PageUp`** | Voltar ao slide anterior |
| **`Q`** | Abrir / Fechar o **Modal Central Gigante de QR Code** (280x280px) |
| **`W`** | **Exibir / Ocultar o Mini-Widget de QR Code** do rodapé (ganhar espaço) |
| **`M`** | Abrir / Fechar o **Mural de Perguntas da Audiência** (Top 10 não respondidas) |
| **`P`** | Alternar o **Modo Púlpito** (notas do orador privativas no notebook) |
| **`V`** | **Abrir / Encerrar Votação** da enquete do slide atual |
| **`R`** | **Revelar / Ocultar Resultados** com gráficos animados no telão |
| **`B`** | Modo **Blackout** (tela preta para focar a atenção no palestrante) |
| **`F`** | Alternar modo **Tela Cheia** (Fullscreen) |
| **`Esc`** | Fechar modais abertos (QR Code gigante ou Mural de Perguntas) |

---

## 8. Gestão de Múltiplas Apresentações & Histórico

O Painel do Moderador & Admin (`/admin/`) conta com gestão do ciclo de vida das apresentações:
- **📚 Histórico de Sessões**: Lista todas as apresentações passadas com data, total de participantes, votos e perguntas.
- **📥 Exportação Consolidada**: Download em JSON de relatórios de sessões individuais ou de todas as sessões combinadas.
- **🗑️ Apagar Sessões Antigas**: Limpeza de dados antigos para manter o banco e o armazenamento organizados.
- **🚀 Iniciar Nova Sessão Limpa**: Cria uma nova sessão com código personalizado (ex: `SDWAN_TURMA_B`), arquivando a anterior e reiniciando a plataforma com 0 votos, 0 perguntas e slide no início.

---

## 9. Segurança Declarativa via JSON & Autenticação Híbrida

A plataforma permite configurar regras de segurança, senhas e usuários locais de forma simples através do arquivo `config/security.json`:

### 9.1 Configuração Global de Segurança (`config/security.json`)
```json
{
  "admin": {
    "pin": "2026",
    "allowedEmails": ["admin@suaempresa.com.br", "palestrante@suaempresa.com.br"],
    "users": [
      { "username": "admin", "password": "123", "role": "admin", "name": "Mesa Técnica" }
    ]
  },
  "offlineAudience": {
    "enabled": true,
    "users": [
      { "username": "participante1", "password": "123", "name": "Participante 01" },
      { "username": "convidado", "password": "123", "name": "Convidado" }
    ]
  }
}
```

### 9.2 Modos de Segurança por Apresentação (`manifest.json`)
No arquivo `manifest.json` de cada palestra, defina o bloco `"security"`:
- **`"mode": "public"`**: Apresentação aberta; identificação necessária apenas para votar ou enviar perguntas.
- **`"mode": "pin"`**: O smartphone do participante exige o PIN do evento (ex: `pin: "7482"`) antes de exibir os slides.
- **`"mode": "restricted"`**: Exige login com e-mail corporativo (`allowedDomains`) ou usuário local autorizado.

---

## 10. Material Piloto Integrado

Esta implantação inclui como demonstrações técnicas completas:
- **`sdwan-cpe-unificado`**: Apresentação pública técnica baseada no documento oficial com 12 slides aprofundados.
- **`treinamento-interno-pin`**: Demonstração de apresentação com controle de acesso protegido por PIN do evento (`PIN: 7482`).
