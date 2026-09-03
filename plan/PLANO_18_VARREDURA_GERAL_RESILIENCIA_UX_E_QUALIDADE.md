# Plano 18 — Varredura Geral, Resiliência de UX, Bloqueio de Atalhos e Garantia de Qualidade

## 1. Visão Geral e Diagnóstico das Causas Raízes

Durante a evolução contínua da plataforma (Planos 01 a 17), foram adicionadas camadas de segurança, autenticação multi-método, sincronização em tempo real e interfaces especializadas (Mesa Técnica, Telão de Palco, Audiência Mobile, Studio e Portal).

Ao navegar entre as interfaces, foram identificados pontos de atrito onde a interface parecia não responder ou comportava-se de modo diferente do esperado. Este plano documenta o diagnóstico técnico detalhado de **por que esses problemas acontecem**, **como foram e serão prevenidos**, e estabelece o **roteiro de correções de resiliência e polimento de UX em todas as 5 interfaces**.

---

## 2. Por que esses problemas acontecem e não foram identificados antes?

### A. Testes Sintéticos de Backend vs. Renderização do Motor do Navegador (CSS Cascading)
* **O que acontecia:** A suíte de testes automatizados (`tests/test_suite.py`) realiza requisições HTTP e valida expressões regulares no código-fonte retornado (`assert 'id="portal-global-lock-modal"' in content`). O teste confirmava com 100% de sucesso que os elementos HTML e endpoints JSON estavam presentes e corretos.
* **O ponto cego:** O teste sintético não emula o motor de renderização de CSS do navegador (WebKit/Blink/Gecko). No arquivo `css/components.css`, a classe base `.modal-overlay` possui `opacity: 0; pointer-events: none;` por padrão e depende exclusivamente de `.modal-overlay.active` para se tornar visível (`opacity: 1`) e clicável. Ao aplicar `style.display = 'flex'` sem adicionar a classe `.active`, o modal existia no DOM com layout flexível, porém permanecia **100% transparente e insensível a cliques**, fazendo a página parecer "congelada".

### B. Desacoplamento entre Escopos Globais (Matriz Multi-Auth) e Metadados Locais do Manifesto
* **O que acontecia:** O sistema de segurança original foi concebido para proteger apresentações individuais através do arquivo `manifest.json` (`security.mode: "pin"`). Quando implementamos a Matriz de Governança Global no Plano 17 (`multiAuth.scopes.presenter`), o controlador do telão (`presenter-app.js`) continuava validando prioritariamente a flag local da apresentação, liberando apresentações públicas sem consultar se a organização havia ativado o escopo global de palco.

### C. Ciclo de Vida de Sessão e Isolamento de Abas
* **O que acontecia:** A autenticação do administrador grava chaves em `sessionStorage` (`admin_pin_authenticated`). No navegador, cada nova aba aberta manualmente ou via link externo (`target="_blank"`) possui um contexto de `sessionStorage` isolado. Se o usuário abre o Portal em uma aba e o Telão em outra aba independente, a autenticação realizada na primeira aba não é herdada automaticamente pela segunda, exigindo nova identificação conforme as regras de segurança corporativa.

### D. Atalhos de Teclado e Eventos sem "Guards" de Bloqueio
* **O que acontecia:** O listener global de teclado (`keydown`) interceptava atalhos como `ArrowRight`, `ArrowLeft`, `P`, `Q` e `M`. Mesmo quando o telão estava com o modal de autenticação na tela, o listener não verificava se o telão estava no estado `.presenter-locked`, permitindo que os slides avançassem por trás da tela de bloqueio.

---

## 3. Matriz de Varredura por Interface

| Interface | Ponto Identificado | Ação Corretiva Proposta | Status |
| :--- | :--- | :--- | :--- |
| **🎤 Telão de Palco** (`/presenter/`) | Decks públicos ignoravam escopo global de palco | Validar `multiAuth.scopes.presenter` via `/api/auth/public-config` | ✅ Corrigido |
| **🎤 Telão de Palco** (`/presenter/`) | Teclas de navegação funcionavam sob bloqueio | Adicionar guard `if (document.body.classList.contains('presenter-locked')) return;` | 🔄 Em Execução |
| **🏢 Portal Inicial** (`/index.html`) | Modo Intranet aplicava desfoque mas modal ficava invisível | Usar `classList.add('active')` e sincronizar `multiAuth.scopes.portal` | ✅ Corrigido |
| **🏢 Portal Inicial** (`/index.html`) | Exportação de ZIP sem confirmação de PIN em decks protegidos | Integrar abertura do modal de PIN antes do disparo de exportação | ✅ Corrigido |
| **🎨 SlideMesh Studio** (`/import.html`) | Escopo `multiAuth.scopes.studio` não verificado no carregamento | Checar credenciais ao carregar e antes de permitir criação/edição | 🔄 Em Execução |
| **🌐 Sistema i18n** (`i18n-engine.js`) | Textos dos modais de segurança sem chaves de tradução EN/PT | Inserir dicionário completo de segurança em `TRANSLATIONS` | 🔄 Em Execução |
| **🚪 Gestão de Sessão** | Falta de botão de Logout no Telão e no Portal | Adicionar ação de encerramento de sessão e limpeza de credenciais | 🔄 Em Execução |

---

## 4. Fases de Execução do Plano 18

### Fase 1: Blindagem de Atalhos e Teclas no Telão de Palco
* Adicionar verificação estrita de bloqueio no listener de `keydown` do `presenter-app.js`.
* Desativar navegação remota e troca de modos de visualização enquanto o telão estiver no estado `.presenter-locked`.

### Fase 2: Mapeamento Completo de Dicionários i18n
* Atualizar `js/core/i18n-engine.js` com todas as chaves de internacionalização utilizadas nos modais de segurança:
  * `presenter.lock_title`, `presenter.lock_desc`, `presenter.btn_unlock_pin`, `presenter.btn_unlock_user`, `presenter.google_desc`.
  * `portal.lock_title`, `portal.lock_desc`, `portal.btn_unlock_pin`, `portal.btn_unlock_user`.
  * `studio.lock_title`, `studio.lock_desc`.

### Fase 3: Governança do SlideMesh Studio com Matriz Multi-Auth
* No arquivo `import.html`, consultar `/api/auth/public-config`.
* Se `multiAuth.scopes.studio === true` e o usuário não possuir credencial de administrador ou palestrante, exibir modal de bloqueio antes de liberar os assistentes de criação e edição.

### Fase 4: Encerramento de Sessão & Logout Unificado
* Adicionar botão de "Sair / Encerrar Sessão" no Header do Telão de Palco e no Rodapé do Portal Inicial.
* Ao clicar em sair, limpar `sessionStorage` (`admin_pin_authenticated`, `pres_pin_*`, `unlocked_session_*`) e reativar o gatekeeper de segurança imediatamente.

### Fase 5: Expansão da Suíte de Testes (Teste 37 & Validação Estrutural)
* Adicionar o Teste 37 em `tests/test_suite.py` para validar a presença de classes `.active`, chaves de internacionalização completas e bloqueio de atalhos.

---

## 5. Critérios de Homologação e Conclusão

1. Todas as 5 telas abrem com visibilidade correta, foco nos campos e sem congelamentos.
2. Atalhos de teclado são bloqueados 100% durante o estado de autenticação pendente.
3. Alternância de idioma para Inglês (`🇺🇸 EN`) e Português (`🇧🇷 PT`) traduz perfeitamente os modais de segurança.
4. Suíte de testes automatizados (`tests/test_suite.py`) com 100% de aprovação (37/37 testes).
