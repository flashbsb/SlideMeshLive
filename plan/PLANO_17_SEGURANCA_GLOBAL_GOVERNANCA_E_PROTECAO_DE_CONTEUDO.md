# PLANO 17 — Segurança Global, Governança Multi-Auth e Proteção de Conteúdo nas Interfaces Web

## 📋 Visão Executiva & Conceito de Identidade Unificada

O **SlideMeshLive** possui uma arquitetura de segurança híbrida e modular, capaz de operar tanto em ambientes 100% offline (redes locais Wi-Fi/LAN sem conexão externa) quanto conectados à internet com provedores corporativos.

A governança de segurança **não se limita a um simples PIN numérico**, mas sim opera sobre uma **Matriz de Autenticação Híbrida Multi-Auth (Multi-Modal)**. O administrador possui total flexibilidade para habilitar **no mínimo 1 método de autenticação** (ou qualquer combinação dos 3 pilares de identidade), definindo com clareza quais interfaces e escopos serão protegidos:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              ECOSSISTEMA DE IDENTIDADE MULTI-AUTH SLIDEMESHLIVE                 │
├─────────────────────────┬─────────────────────────────┬─────────────────────────┤
│       🔑 1. PIN         │      👤 2. CONTA LOCAL      │   🌐 3. GOOGLE / SSO    │
│  (Acesso Ágil / Deck)   │    (RBAC Offline / Cred)    │    (Workspace / Nuvem)  │
├─────────────────────────┼─────────────────────────────┼─────────────────────────┤
│ • PIN de Deck Específico│ • Admin (Mesa Técnica)      │ • Login via Popup/OAuth │
│ • PIN Mestre do Evento  │ • Palestrante (Apresentador)│ • Whitelist corporativa │
│ • PIN de Intranet/Portal│ • Participante (Crachá/Senha│   (@suaempresa.com.br)  │
└─────────────────────────┴─────────────────────────────┴─────────────────────────┘
```

---

## 🛡️ Regra Fundamental: Flexibilidade de Métodos & Garantia Anti-Lockout

1. **Liberdade de Escolha (Mínimo de 1 Método Ativo):**
   * O administrador pode optar por utilizar:
     * **Apenas PIN:** (Ex: evento ágil em rede local, sem necessidade de cadastrar logins nominais).
     * **Apenas Contas Locais RBAC:** (Ex: evento corporativo fechado com contas nominais para cada palestrante e operador).
     * **Apenas Google Workspace:** (Ex: organização que já utiliza SSO corporativo com domínio `@empresa.com.br`).
     * **Modo Híbrido (2 ou 3 Métodos Simultâneos):** Permitindo ao operador e aos palestrantes escolherem a forma mais conveniente para entrar no palco ou na mesa técnica.
2. **Garantia Anti-Lockout (Proteção contra Bloqueio Acidental):**
   * O sistema valida tanto no **Setup Wizard (`setup.html`)** quanto no **Painel da Mesa Técnica (`admin/index.html`)** que pelo menos um método de autenticação válido com credenciais preenchidas permaneça ativo antes de permitir salvar as alterações.

---

## 🎯 Diagnóstico de Exposição & Mapeamento Multi-Auth por Interface

```
                               ┌──────────────────────────────────────────────┐
                               │       PORTAL INICIAL (/index.html)           │
                               │  [Lobby Aberto vs. Modo Intranet Multi-Auth] │
                               │  🔑 PIN • 👤 Crachá/Usuário • 🌐 Google      │
                               └──────┬──────────────┬──────────────┬─────────┘
                                      │              │              │
                   ┌──────────────────┘              │              └──────────────────┐
                   ▼                                 ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
      │ TELÃO / PALCO           │       │ MESA TÉCNICA (/admin/)  │       │ AUDIÊNCIA MOBILE        │
      │ (/presenter/)           │       │ [Status: 100% Blindada] │       │ (/audience/)            │
      │ 🛡️ Gatekeeper Multi-Auth│       │ 🛡️ Multi-Auth Gatekeeper│       │ 📱 Multi-Identidade:    │
      │ 🔑 PIN • 👤 Palestrante │       │ 🔑 PIN • 👤 Admin       │       │ • Anônimo Automático    │
      │ 🌐 Google Workspace     │       │ 🌐 Google Whitelist     │       │ 🔑 PIN de Deck          │
      └─────────────────────────┘       └─────────────────────────┘       │ 👤 Crachá / 🌐 Google   │
                   │                                                      └─────────────────────────┘
                   ▼                                                                   │
      ┌─────────────────────────┐                                                      ▼
      │ SLIDEMESH STUDIO        │                                         ┌─────────────────────────┐
      │ (/import.html)          │                                         │ BACKEND HTTP / APIs     │
      │ 🔒 Edição Protegida:    │                                         │ (server.py)             │
      │ 🔑 PIN • 👤 Orador/Admin│                                         │ 🛡️ Zero Client-Side     │
      │ 🌐 Google Autorizado    │                                         │    Secret Leak          │
      └─────────────────────────┘                                         └─────────────────────────┘
```

---

## 🏗️ Estrutura das Fases de Implementação

---

### 🛡️ FASE 1: Sanitização do Manifesto & Verificação de Segredos 100% Server-Side

* **Objetivo:** Garantir que nenhum cliente (navegador, celular ou scraper) receba o PIN em texto puro, transformando a validação em 100% server-side e blindando dados estruturais.
* **Ações:**
  1. **Sanitização de Manifesto no `server.py`:**
     - Interceptar requisições `GET /presentations/<id>/manifest.json` e `/api/presentations/catalog`.
     - O backend remove dinamicamente a propriedade `"pin"` de payloads entregues a clientes não autenticados, mantendo apenas `"mode": "pin"`, `"pinHint"` e `"allowReviewPast"`.
  2. **Refatoração no Cliente (`audience-app.js`, `presenter-app.js`, etc.):**
     - Eliminar verificações locais em texto claro (`entered === manifest.security.pin`).
     - Delegar 100% da validação de PIN para o endpoint seguro `POST /api/auth/verify-pin` e credenciais para `POST /api/auth/login`.
  3. **Proteção de `slides.json` para Apresentações Restritas:**
     - Interceptar `GET /presentations/<id>/slides.json`: se a apresentação possuir `security.mode === 'pin'`, o backend só entrega o conteúdo de slides para requisições que possuam token/sessão autorizada.

---

### 🖥️ FASE 2: Gatekeeper Multi-Auth de Palco no Telão do Apresentador (`/presenter/`)

* **Objetivo:** Proteger o palco, a projeção 16:9 e as notas privadas de orador no Púlpito com suporte total às 3 modalidades de autenticação.
* **Ações:**
  1. **Modal Multi-Auth de Palco (`#presenter-auth-modal`):**
     - Interface limpa e cinematográfica com 3 abas de acesso dinâmicas (exibe apenas as abas dos métodos ativos na configuração):
       - **🔑 Aba 1 (PIN Rápido):** Aceita o PIN específico da apresentação (ex: `7482`) OU o PIN mestre do evento (`2026`).
       - **👤 Aba 2 (Usuário & Senha Local):** Permite login com papel de `palestrante` (ex: `palestrante` / `palestrante2026`) ou `admin`.
       - **🌐 Aba 3 (Google Workspace):** Autenticação corporativa com e-mails autorizados na whitelist (`allowedEmails` em `config/security.json`).
  2. **Desfoque Protetor e Bloqueio de Notas:**
     - Enquanto bloqueado, o telão permanece em estado `.presenter-locked` com desfoque total dos slides, ocultando notas de orador e miniaturas de púlpito.
  3. **Herança Transparente de Sessão:**
     - Se o palestrante ou operador de palco já tiver se autenticado no mesmo navegador (na Mesa Técnica ou em outra aba de apresentação), o telão detecta a sessão ativa e abre instantaneamente.

---

### 🌐 FASE 3: Proteção de Ações & Modo Intranet Corporativa no Portal Inicial (`/index.html`)

* **Objetivo:** Controlar a exposição do catálogo e proteger ações de edição, download e acesso com suporte a eventos abertos e eventos corporativos fechados.
* **Ações:**
  1. **Gatekeeper de Ações por Deck nos Cards do Portal:**
     - Ao clicar em `🖥️ Telão`, `📱 Celular`, `✏️ Editar` ou `📦 Exportar ZIP` em cards com badge `🔒 PIN`:
       - Se o usuário já tiver autenticação ativa, prossegue diretamente.
       - Se não estiver autenticado, abre modal rápido Multi-Auth (PIN, Usuário ou Google) para liberar a ação.
  2. **Modo Intranet Corporativa Fechada (`portal.requireAuth`):**
     - Adicionar suporte a `"portal": { "requireAuth": false }` no `config/security.json`.
     - Quando ativado (`true`), o `index.html` renderiza uma tela de recepção corporativa com as opções ativas da Matriz Multi-Auth (**🔑 PIN do Evento**, **👤 Usuário/Crachá**, **🌐 Google Workspace**) antes de expor os cards de palestras e arquivos.

---

### 🎨 FASE 4: Hardening Multi-Auth do SlideMesh Studio (`/import.html`) e Endpoints de Arquivo

* **Objetivo:** Impedir edição não autorizada de código-fonte de slides e download de pacotes ZIP com dados sigilosos.
* **Ações:**
  1. **Gatekeeper Multi-Auth no SlideMesh Studio (`import.html` / `import-app.js`):**
     - Ao abrir `import.html?edit=<id>` para um deck protegido por PIN:
       - Exige autenticação via PIN do deck, Usuário Local (Palestrante/Admin) ou Google autorizado antes de popular os slides no editor visual.
  2. **Proteção do Endpoint de Exportação (`GET /api/presentations/export`):**
     - Se o deck for protegido, o download do `.slidemesh.zip` exige validação de credencial (via query parameter `?pin=...` ou cabeçalhos `X-Admin-PIN` / `Authorization`).
  3. **Proteção dos Endpoints de Importação (`POST /api/presentations/import` e `/api/presentations/import-zip`):**
     - Exigir token/PIN de administrador para criação ou substituição de arquivos no disco.

---

### ⚡ FASE 5: Blindagem da Comunicação Smartphone-Servidor, Anti-Spoofing, Rate Limiting & HTTPS

* **Objetivo:** Neutralizar interceptações de rede (sniffing), injeções de comandos forjados por celulares (spoofing), fraudes em enquetes (bot voting) e ataques de spam/XSS na moderação.
* **Ações:**
  1. **Segregação Estrita de Papéis Server-Side (Role Segregation no `/api/sync`):**
     - O backend classifica estritamente eventos em **Públicos** vs **Restritos/Administrativos**:
       * *Públicos (Celulares):* `REACTION_SENT`, `NEW_QUESTION`, `QUESTION_UPVOTE`, `VOTE_CAST`, `PRESENCE_PING`, `PRESENCE_LEAVE`.
       * *Restritos (Admin/Palco):* `SWITCH_ACTIVE_PRESENTATION`, `CLEAR_ALL_QUESTIONS`, `QUESTION_STATUS_CHANGE`, `RESET_POLL`, `RESET_ALL_POLLS`, `SESSION_STATE_UPDATE`, `SET_PACING_MODE`, `TRIGGER_STAGE_FX`, `MEDIA_CONTROL_ACTION`.
     - Se uma requisição sem token/PIN administrativo tentar emitir um comando restrito, o servidor rejeita imediatamente com **`403 Forbidden`** e descarta a mensagem.
  2. **Rate Limiting & Cooldown Anti-Flood (Proteção contra Loops/Scripts):**
     - *Anti-Spam de Perguntas:* Cooldown de 10 segundos por participante entre envios de novas perguntas.
     - *Anti-Fraude de Votos:* Trava atômica por `uid` e IP garantindo exatamente 1 voto por enquete.
     - *Throttling de Reações:* Janela deslizante limitando disparos repetitivos a no máximo 10 req/s por IP (retorna `429 Too Many Requests`).
  3. **Sanitização Server-Side contra Injeção de Código (XSS):**
     - O servidor sanitiza todo o texto de `NEW_QUESTION` e apelidos de participantes, removendo tags perigosas (`<script>`, `<iframe>`, atributos `onload/onerror`) e limitando o tamanho máximo do texto a 300 caracteres.
  4. **Criptografia em Trânsito (Suporte HTTPS / TLS Local no `server.py`):**
     - Adicionar suporte à flag `--ssl` no `server.py` com carregamento de certificado (`config/cert.pem`, `config/key.pem`) ou geração de certificado TLS local para que toda a comunicação via Wi-Fi seja 100% criptografada de ponta a ponta (TLS 1.3), impedindo que qualquer usuário capture pacotes via Wireshark.

---

### ⚙️ FASE 6: Reformulação Visual do Wizard e Painel de Governança na Mesa Técnica

* **Objetivo:** Tornar extremamente simples, visual e intuitivo para o administrador configurar a Matriz Multi-Auth e os escopos de proteção, tanto no primeiro uso (Wizard) quanto no dia a dia (Mesa Técnica).
* **Ações:**

#### 6.1. Reformulação do First-Run Setup Wizard (`setup.html` / `setup-app.js`):
  * **Passo 1 (Seleção de Métodos Ativos):** Exibir 3 cards visuais clicáveis permitindo selecionar 1, 2 ou todos os 3 métodos:
    * `[x] 🔑 PIN Mestre de Acesso Rápido`
    * `[x] 👤 Conta Local de Administrador e Oradores (RBAC)`
    * `[ ] 🌐 Google Workspace / SSO Corporativo (Whitelist)`
  * **Validação Interativa:** O botão de avançar só é liberado se pelo menos 1 método estiver selecionado e devidamente preenchido.
  * **Passo 2 (Escopos de Proteção Iniciais):** Checkboxes claros com descrições objetivas:
    * `[x] Proteger Mesa Técnica (/admin/)`
    * `[x] Proteger Telão de Palco (/presenter/) para Decks Confidenciais`
    * `[x] Proteger Edição no Studio e Exportação ZIP`
    * `[ ] Ativar Modo Intranet Fechado no Portal (/index.html)`

#### 6.2. Matriz Visual de Governança na Mesa Técnica (`admin/index.html` / `admin-app.js`):
  * Na primeira aba do modal de segurança (**🔑 Matriz Multi-Auth & Escopos**), exibir um painel visual consolidado com:
    1. **Cards de Métodos:** Toggles de ligar/desligar com status em tempo real (🟢 Ativo / ⚪ Desativado) para PIN, Usuários Locais e Google.
    2. **Grid de Escopos Protegidos:** Lista de interfaces com toggle instantâneo.
    3. **Prevenção de Erro:** Se o administrador tentar desativar todos os métodos, o sistema exibe alerta e impede o salvamento.

#### 6.3. Documentação & Testes Automatizados:
  * Atualizar `README.md` e `README.pt-BR.md` com a Matriz de Governança Multi-Auth das 5 interfaces.
  * Adicionar bateria completa de testes cobrindo o seletor de métodos, a regra de no mínimo 1 método ativo e a proteção de todas as interfaces no `tests/test_suite.py`.

---

## 📊 Matriz de Governança Multi-Auth por Interface

| Interface / Ação | Mecanismo 1: 🔑 PIN | Mecanismo 2: 👤 Usuário Local | Mecanismo 3: 🌐 Google OAuth |
| :--- | :--- | :--- | :--- |
| **Telão Palco (`/presenter/`)** | PIN do Deck OU PIN Mestre | Conta `palestrante` ou `admin` | E-mail autorizado na Whitelist |
| **Mesa Técnica (`/admin/`)** | PIN Mestre do Evento | Conta `admin` ou `presenter` | E-mail autorizado na Whitelist |
| **Portal Inicial (`/index.html`)** | PIN do Evento (Modo Intranet) | Contas Locais / Crachá | E-mail corporativo autorizado |
| **Studio Editor (`/import.html`)** | PIN do Deck OU PIN Mestre | Conta `palestrante` ou `admin` | E-mail autorizado na Whitelist |
| **Audiência Mobile (`/audience/`)** | PIN do Deck (se protegido) | Login de Crachá / Senha | Google Sign-In (Nome + Avatar) |
| **Exportar ZIP (`/api/.../export`)** | PIN do Deck no parâmetro/header| Token de Sessão Local | Token de Sessão Google |

---

## 📋 Checklist de Homologação

- [ ] Administrador pode ativar qualquer combinação de métodos (no mínimo 1 obrigatório: PIN, Local ou Google).
- [ ] O Wizard inicial (`setup.html`) permite escolher visualmente quais métodos e escopos deseja ativar no primeiro uso.
- [ ] A Mesa Técnica (`admin/index.html`) exibe a Matriz Visual de Governança com toggles e prevenção anti-lockout.
- [ ] `manifest.json` servido via HTTP nunca expõe a chave `"pin"` em texto claro para clientes não autenticados.
- [ ] Validação de PIN e Credenciais ocorre 100% no backend (`/api/auth/verify-pin` e `/api/auth/login`).
- [ ] Comandos administrativos em `/api/sync` enviados por smartphones não autorizados são bloqueados com `403 Forbidden`.
- [ ] Rate limiting impede loops de votação forjada e flood de perguntas.
- [ ] Telão do Apresentador (`/presenter/`) exibe modal Multi-Auth (com as abas dos métodos ativos) para decks protegidos.
- [ ] O Púlpito do Telão oculta notas de orador e miniaturas de slides enquanto bloqueado.
- [ ] Botões de edição no Studio e download de pacote ZIP validam autenticação para decks protegidos.
- [ ] O Portal Inicial suporta ativação do Modo Intranet Fechado via `security.json` com recepção Multi-Auth.
- [ ] 100% dos testes automatizados (`python3 tests/test_suite.py`) homologados com sucesso.
