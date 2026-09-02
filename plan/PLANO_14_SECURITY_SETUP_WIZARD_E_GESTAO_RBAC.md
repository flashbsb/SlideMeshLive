# PLANO 14: FIRST-RUN SECURITY WIZARD, GESTÃO DE USUÁRIOS/RBAC NA MESA TÉCNICA E CONFIGURAÇÃO DE ACESSO NO STUDIO

## 1. Visão Geral e Contexto

Este plano detalha a arquitetura, experiência do usuário (UX) e especificações técnicas para atender às 3 melhorias propostas, somadas a aprimoramentos complementares de segurança operacional para o SlideMeshLive:

1. **First-Run Security Setup Wizard (Assistente de Primeiro Uso):**
   - Quando o sistema for iniciado pela primeira vez e não existir o arquivo de produção `config/security.json`, a aplicação ativa um assistente guiado visual (Web & CLI) para que o administrador defina o **PIN mestre**, a **conta do administrador** e as **políticas de acesso**, eliminando o risco de exposição com credenciais padrão em eventos ao vivo.
2. **Painel de Gestão de Segurança & Controle de Usuários (Security Hub na Mesa Técnica):**
   - Inclusão de um modal completo de gerenciamento no console do moderador (`admin/index.html`) para alterar o PIN mestre, cadastrar/editar/excluir contas de administradores e palestrantes, gerenciar usuários offline da audiência e configurar domínios/e-mails autorizados do Google Workspace sem necessidade de editar manualmente arquivos JSON.
3. **Configuração Avançada de Segurança e Ritmo por Apresentação no Studio (`import.html`):**
   - Enriquecimento da interface do SlideMesh Studio com campos dinâmicos ao selecionar apresentação protegida por PIN: definição do código do PIN com gerador randômico de 4 dígitos, texto de dica (*pinHint*) e controle de revisão de slides passados (*allowReviewPast*), gravando a estrutura correta no `manifest.json`.
4. **Indicador de Saúde de Segurança & Gatekeeper por Apresentação no Mobile:**
   - Badge de alerta na Mesa Técnica alertando se a apresentação está aberta ou protegida, e tela de desbloqueio por PIN para o público no smartphone conectada ao backend.

---

## 2. Diagnóstico e Justificativa das Melhorias

| Item | Situação Atual | Risco / Limitação | Solução Proposta no Plano 14 |
|---|---|---|---|
| **01. Setup Inicial** | Se `config/security.json` não existe, o servidor carrega `security.example.json` com PIN `2026` e senhas padrão. | Um operador desatento pode subir o sistema em produção com credenciais conhecidas, expondo o painel administrativo. | Assistente de configuração inicial obrigatório (Wizard Web & CLI) que solicita a criação de credenciais próprias antes de liberar a plataforma. |
| **02. Gestão no Admin** | Não há interface gráfica para alterar PIN, adicionar palestrantes ou gerenciar participantes offline. | Para criar um usuário novo para um palestrante convidado, o operador precisa abrir um editor de texto e manipular JSON no servidor. | Modal **"🔐 Gestão de Segurança & Acesso"** na Mesa Técnica com abas para PIN, Usuários Admin/Palestrante, Audiência Offline e Whitelist Google. |
| **03. Segurança no Studio** | O Studio possui apenas o dropdown `#cfg-security` ("Pública" vs "Protegida por PIN"), sem campos para definir o PIN ou dica. | A apresentação fica marcada como `mode: "pin"`, mas sem PIN específico definido no `manifest.json`, herdando validações genéricas. | Exibição condicional de campos de **PIN da Apresentação**, **Gerador 1-Clique de PIN**, **Dica da Plateia** e **Permissão de Revisão de Slides Passados**. |

---

## 3. Fases de Implementação

### 🚀 Fase 1: First-Run Security Setup Wizard (Web & CLI) — [CONCLUÍDA]
- [x] **Backend (`server.py`):**
  - [x] Detectar a ausência de `config/security.json`.
  - [x] Se ausente, sinalizar `setupRequired: true` no endpoint `GET /api/auth/public-config`.
  - [x] Criar endpoint protegido `POST /api/auth/setup` (disponível estritamente quando `security.json` não existe) que valida os dados informados, cria o arquivo com permissões adequadas e inicializa o sistema com segurança.
  - [x] Implementar suporte a `--setup` via linha de comando (`python3 server.py --setup`) com prompt interativo seguro no terminal.
- [x] **Interface Web de Primeiro Uso (`setup.html` ou Modal de Inicialização):**
  - [x] Passo 1: Definição do PIN Mestre da Mesa Técnica (com opção de gerar PIN seguro).
  - [x] Passo 2: Criação do Usuário e Senha do Administrador Principal.
  - [x] Passo 3: Configuração de modo de audiência e login corporativo (opcional).
  - [x] Feedback visual de conclusão com redirecionamento para a Mesa Técnica já autenticado.

### 🚀 Fase 2: Painel de Gestão de Segurança na Mesa Técnica (`admin/index.html` e `admin-app.js`) — [CONCLUÍDA]
- [x] **Modal de Segurança (`#admin-security-settings-modal`):**
  - [x] **Aba 1 (🔑 PIN & Políticas):** Alterar PIN da Mesa Técnica, alternar exigência de PIN para admin, gerador de PIN.
  - [x] **Aba 2 (👥 Administradores & Palestrantes):** Tabela de usuários locais com badges de papel (`admin` / `presenter`), formulário modal para criar novo usuário, trocar senha e excluir contas.
  - [x] **Aba 3 (📱 Audiência Offline):** Toggle para ativar/desativar audiência offline, lista de participantes autorizados com nome e senha simplificada, botão para adicionar participante.
  - [x] **Aba 4 (🌐 Google Workspace):** Lista de e-mails/domínios corporativos permitidos na whitelist.
- [x] **Endpoints Autenticados no Backend (`server.py`):**
  - [x] `GET /api/security/config`: Retorna a configuração de segurança completa (requer sessão de admin ativa).
  - [x] `POST /api/security/config`: Gravação atômica em `config/security.json` com validação de payload, sanitização e descarte de senhas em branco.
- [x] **Integração no Frontend (`admin-app.js`):**
  - [x] Botão no cabeçalho ou menu da Mesa Técnica: **`🔐 Segurança`**.
  - [x] Sincronização em tempo real das alterações sem necessidade de reiniciar o servidor Python.

### 🚀 Fase 3: Configuração de Segurança e Ritmo no SlideMesh Studio (`import.html` & `conversion-engine.js`) — [CONCLUÍDA]
- [x] **Campos Dinâmicos de Segurança na Etapa 2 do Studio:**
  - [x] Quando `#cfg-security` for alterado para `"pin"`:
    - [x] Exibir card com campo `#cfg-pin-code` (PIN de 4 dígitos) e botão `🎲 Gerar PIN`.
    - [x] Exibir campo `#cfg-pin-hint` (Dica para os participantes no celular, ex: "Solicite o código ao palestrante").
  - [x] Na seção `#cfg-pacing`:
    - [x] Adicionar checkbox/toggle `#cfg-pacing-allow-past` ("Permitir que a plateia revise slides anteriores").
- [x] **Persistência no `manifest.json`:**
  - [x] O motor do Studio grava a estrutura completa no manifesto:
    ```json
    "security": {
      "mode": "pin",
      "pin": "7482",
      "pinHint": "Digite o código informado pelo palestrante"
    },
    "pacing": {
      "mode": "lock_future",
      "allowReviewPast": true
    }
    ```

### 🚀 Fase 4: Experiência da Audiência e Alertas de Saúde de Segurança — [CONCLUÍDA]
- [x] **Validação de PIN no Smartphone (`audience/index.html` e `audience-app.js`):**
  - [x] Quando uma apresentação tiver `security.mode: "pin"`, exibir modal de bloqueio solicitando o PIN específico da apresentação com a dica cadastrada (`pinHint`).
  - [x] Validação do PIN via `POST /api/auth/verify-pin` enviando o `presentationId` com fallback offline.
- [x] **Badge de Alerta na Mesa Técnica (`admin/index.html` e `admin-app.js`):**
  - [x] Indicador visual no card de saúde / diagnóstico: `🛡️ Seg. Alta` (PIN customizado + RBAC) ou `⚠️ PIN Padrão` (Setup Pendente).

### 🚀 Fase 5: Testes Automatizados, Homologação e Documentação — [CONCLUÍDA]
- [x] Adicionar testes na suíte `scratch/test_suite.py`:
  - [x] Teste de fluxo de Primeiro Uso (`POST /api/auth/setup` & CLI `--setup`).
  - [x] Teste dos endpoints autenticados `GET /api/security/config` e `POST /api/security/config`.
  - [x] Teste de criação, edição e exclusão de usuários administradores e palestrantes.
  - [x] Teste de salvamento e leitura de apresentações com PIN específico e Pacing customizado no Studio.
  - [x] Teste de validação de PIN de apresentação na visão da audiência com Gatekeeper e badge de saúde.
- [x] Atualização dos manuais [`README.pt-BR.md`](README.pt-BR.md) e [`README.md`](README.md).

---

## 4. Matriz de Componentes e Arquivos

| Componente | Arquivos Principais | Responsabilidade |
|---|---|---|
| **Setup Wizard (Primeiro Uso)** | `server.py`, `setup.html`, `js/core/auth-engine.js` | Detecção de primeiro uso, assistente guiado e geração atômica de `security.json`. |
| **Gestão de Segurança Admin** | `admin/index.html`, `js/admin/admin-app.js`, `server.py` | Modal de gestão com 4 abas para PIN, Usuários, Audiência Offline e Google. |
| **Configuração no Studio** | `import.html`, `js/core/conversion-engine.js` | Edição visual de PIN, Dica e Pacing por apresentação com persistência no `manifest.json`. |
| **Gatekeeper da Audiência** | `audience/index.html`, `js/audience/audience-app.js` | Bloqueio e solicitação de PIN por apresentação na visão mobile. |
| **Suíte de Testes & Docs** | `scratch/test_suite.py`, `README.pt-BR.md`, `README.md` | Homologação com 100% de cobertura e documentação oficial. |

---

## 5. Proposta de Interface Amigável (Mockups Textuais)

### 5.1 Modal de Gestão de Segurança na Mesa Técnica (`admin/index.html`)

```text
+-------------------------------------------------------------------------+
| 🔐 Gestão de Segurança & Controle de Acesso                     [ ✕ Fechar ] |
+-------------------------------------------------------------------------+
| [ 🔑 PIN & Políticas ] [ 👥 Usuários ] [ 📱 Audiência ] [ 🌐 Google ]   |
+-------------------------------------------------------------------------+
|                                                                         |
|  🔑 PIN MESTRE DA MESA TÉCNICA                                         |
|  PIN Atual: [ •••• ] (Ex: 2026)      [ 🎲 Gerar Novo PIN ]              |
|  [✓] Exigir PIN para liberar a Mesa Técnica                             |
|                                                                         |
|  👥 USUÁRIOS ADMINISTRATIVOS & PALESTRANTES                             |
|  +-------------------------------------------------------------------+  |
|  | Usuário        | Papel        | Nome                | Ações       |  |
|  +----------------+--------------+---------------------+-------------+  |
|  | admin          | 🛡️ Admin     | Mesa Técnica        | [✏️] [🔑]    |  |
|  | palestrante    | 🎤 Orador    | Palestrante 01      | [✏️] [🔑] [🗑️]|  |
|  +-------------------------------------------------------------------+  |
|  [ + Adicionar Novo Usuário ]                                           |
|                                                                         |
|-------------------------------------------------------------------------|
| [ 💾 Salvar Configurações de Segurança ]              [ Cancelar ]      |
+-------------------------------------------------------------------------+
```

### 5.2 Configuração de PIN no SlideMesh Studio (`import.html`)

```text
+-------------------------------------------------------------------------+
| Segurança: [ 🔒 Protegida por PIN ▼ ]                                   |
|                                                                         |
| ┌─ 🔐 Configuração do PIN de Acesso da Apresentação ──────────────────┐ |
| │ PIN da Plateia: [ 7482      ]  [ 🎲 Gerar PIN ]                      │ |
| │ Dica do PIN:    [ Digite o código de 4 dígitos informado no palco ] │ |
| └─────────────────────────────────────────────────────────────────────┘ |
|                                                                         |
| Ritmo da Plateia: [ 🔒 Travar Avanço (Padrão) ▼ ]                       |
| [✓] Permitir que os participantes voltem para ler slides anteriores     |
+-------------------------------------------------------------------------+
```
