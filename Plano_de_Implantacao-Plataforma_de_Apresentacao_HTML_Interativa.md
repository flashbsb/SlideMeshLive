# Plano de Implantação — Plataforma de Apresentação HTML Interativa

**Versão:** 1.0  
**Objetivo:** Desenvolvimento de uma plataforma de apresentação web sincronizada com participação do público por smartphone.

---

# 1. Objetivo

Desenvolver uma plataforma de apresentação baseada em tecnologias web, composta por dois ambientes integrados:

1. **Painel do Apresentador**
2. **Interface do Público**

A solução deverá permitir que o apresentador conduza uma apresentação HTML enquanto os participantes acompanham, pelo smartphone, informações complementares sobre o conteúdo atualmente apresentado e participam de interações como:

- votações;
- pesquisas;
- quizzes;
- perguntas;
- respostas;
- reações;
- avaliações.

A apresentação principal deverá permanecer visualmente limpa, enquanto o smartphone poderá apresentar informações mais detalhadas.

A comunicação entre apresentador e público deverá ocorrer em tempo real.

---

# 2. Conceito da solução

A solução deverá funcionar como uma aplicação web sincronizada.

```text
                         APRESENTADOR
                              │
                              ▼
                    ┌──────────────────┐
                    │ Presentation UI  │
                    │                  │
                    │ Slide atual      │
                    │ Controle          │
                    │ Votação           │
                    │ Perguntas         │
                    └────────┬─────────┘
                             │
                             │ Internet
                             ▼
                    ┌──────────────────┐
                    │ Firebase Backend  │
                    │                  │
                    │ Authentication   │
                    │ Realtime DB      │
                    │ Hosting          │
                    └────────┬─────────┘
                             │
                   sincronização em tempo real
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
       📱 Público 1       📱 Público 2      📱 Público N
           │                 │                 │
           ▼                 ▼                 ▼
       Conteúdo          Conteúdo          Conteúdo
       complementar      complementar      complementar
           │                 │                 │
           └──────────────┬──┴─────────────────┘
                          ▼
                     Interações
                          │
                          ▼
                     Firebase
```

---

# 3. Princípio fundamental

O sistema deverá possuir um estado central da apresentação.

Exemplo:

```javascript
{
    presentationId: "7F82KQ",
    currentSlide: 12,
    presentationStatus: "running",
    activePoll: "poll-12",
    pollStatus: "open",
    showResults: false
}
```

Quando o apresentador avançar do slide 12 para o slide 13:

```text
currentSlide = 13
```

O backend deverá distribuir essa alteração aos participantes conectados.

Os smartphones deverão então carregar automaticamente o conteúdo associado ao slide 13.

---

# 4. Experiência desejada

## 4.1 Tela do apresentador

O apresentador verá algo semelhante a:

```text
┌──────────────────────────────────────────────┐
│ APRESENTAÇÃO                  Slide 12 / 30  │
├──────────────────────────────────────────────┤
│                                              │
│              CONTEÚDO DO SLIDE               │
│                                              │
│       Alta disponibilidade geográfica       │
│                                              │
├──────────────────────────────────────────────┤
│                                              │
│ [ ← ] [ → ]                                  │
│                                              │
│ [Abrir votação] [Encerrar votação]           │
│                                              │
│ [Mostrar resultados]                         │
│                                              │
│ 👥 Participantes: 87                         │
│ 🟢 Backend: conectado                        │
│                                              │
└──────────────────────────────────────────────┘
```

---

# 5. Experiência desejada no smartphone

O participante deverá acessar uma URL através de QR Code.

Exemplo:

```text
┌────────────────────────────┐
│ APRESENTAÇÃO               │
│                            │
│ 🔴 AO VIVO                 │
│                            │
│ Slide 12                   │
│ Alta disponibilidade       │
│                            │
│ ─────────────────────────  │
│                            │
│ 📖 Entenda melhor          │
│                            │
│ Texto complementar...      │
│                            │
│ [Ver detalhes]             │
│                            │
│ 📊 Diagrama                │
│                            │
│ [Visualizar]               │
│                            │
│ 🔐 Participar              │
│                            │
└────────────────────────────┘
```

O participante poderá ler o conteúdo sem login.

Para realizar ações interativas:

```text
Votar
Enviar pergunta
Responder quiz
Enviar reação
```

deverá realizar autenticação.

---

# 6. Modelo de autenticação

## 6.1 Princípio

Não utilizar anonimato absoluto para ações que possam alterar os resultados.

O modelo recomendado será:

```text
Conteúdo
   ↓
acesso livre

Interação
   ↓
autenticação obrigatória
```

Isso reduz significativamente a possibilidade de manipulação.

---

# 7. Provedor de autenticação

## Primeira versão

Utilizar:

**Google Authentication via Firebase Authentication.**

O participante verá:

```text
┌────────────────────────────┐
│ Participar                 │
│                            │
│ Para votar ou enviar       │
│ perguntas, entre com sua   │
│ conta.                     │
│                            │
│ [ Continuar com Google ]   │
└────────────────────────────┘
```

O Firebase Authentication suporta provedores como Google e fornece um `uid` único para o usuário autenticado, que pode ser utilizado nas regras de acesso do Realtime Database.

---

# 8. Evolução da autenticação

A arquitetura deverá permitir posteriormente:

```text
Google
Microsoft
Microsoft Entra ID
Apple
Email/password
```

Para ambientes corporativos, avaliar Microsoft Entra ID como segundo provedor.

Poderá existir uma configuração:

```text
Authentication Mode

○ Público
● Google
○ Microsoft
○ Microsoft Entra ID
```

---

# 9. Privacidade

A autenticação não significa que a identidade do participante deverá ser exibida ao apresentador.

O sistema poderá internamente possuir:

```text
UID:
83f9d2...
```

mas apresentar ao apresentador:

```text
Participante #83
```

ou simplesmente:

```text
87 participantes
```

Perguntas deverão ser exibidas sem necessidade de apresentar nome ou e-mail ao público.

A aplicação deverá armazenar somente os dados necessários ao funcionamento da solução.

---

# 10. QR Code

A apresentação deverá possuir um QR Code único por sessão.

Exemplo:

```text
https://dominio.com/audience/?session=A8F3K2
```

O QR Code deverá ser exibido no painel do apresentador.

O participante não deverá precisar escanear um QR Code diferente para cada slide.

---

# 11. Sessão da apresentação

Cada execução da apresentação deverá possuir uma sessão.

Exemplo:

```text
Presentation:
SD-WAN-2026

Session:
A8F3K2
```

Ao encerrar a apresentação:

```text
Session A8F3K2 = CLOSED
```

A sessão não deverá mais aceitar novas interações.

Isso evita que alguém continue enviando votos ou perguntas utilizando uma URL antiga.

---

# 12. Estrutura dos slides

O conteúdo deverá ser separado da lógica da aplicação.

Cada slide deverá possuir:

```javascript
{
    id: 12,

    title: "Alta disponibilidade",

    presenter: {
        title: "Alta disponibilidade geográfica",
        bullets: [
            "DC primário",
            "DC secundário",
            "Failover"
        ]
    },

    audience: {
        summary: "...",
        details: "...",
        diagrams: [],
        documents: [],
        links: []
    },

    interaction: {
        enabled: true,
        pollId: "poll-12"
    }
}
```

---

# 13. Conteúdo do apresentador x conteúdo do público

Esse é um requisito fundamental.

## Apresentador

Deve apresentar conteúdo objetivo:

```text
Alta disponibilidade

• DC primário
• DC secundário
• Failover
• Continuidade
```

## Público

Pode receber:

```text
O que é alta disponibilidade?

Descrição detalhada...

Como ocorre o failover?

Quais protocolos podem ser utilizados?

[Ver diagrama]

[Material complementar]
```

Isso permite que a apresentação visual permaneça limpa.

---

# 14. Sincronização

O Firebase Realtime Database deverá ser utilizado para sincronizar o estado da apresentação.

Exemplo:

```text
presentation
 └── session
      ├── currentSlide
      ├── status
      ├── activePoll
      ├── pollStatus
      └── showResults
```

O apresentador será responsável por alterar o estado.

Os participantes terão permissão somente para leitura desse estado.

O Firebase Realtime Database possui regras de segurança que permitem controlar leitura, escrita e validação por usuário autenticado, incluindo o uso do `auth.uid`.

---

# 15. Votação

Cada votação deverá possuir:

```javascript
{
    id: "poll-12",

    question: "Qual solução você adotaria?",

    options: [
        {
            id: "A",
            text: "VRRP"
        },
        {
            id: "B",
            text: "GSLB"
        },
        {
            id: "C",
            text: "BGP Anycast"
        }
    ],

    status: "open"
}
```

Estados:

```text
draft
open
closed
results
```

---

# 16. Regra fundamental de votação

Um usuário autenticado deverá poder votar **uma única vez em cada enquete**.

Exemplo:

```text
poll-12
    │
    ├── UID-A → A
    ├── UID-B → C
    ├── UID-C → B
    └── UID-D → A
```

O banco deverá utilizar o `uid` autenticado como parte da chave ou mecanismo de controle.

Não confiar apenas em JavaScript no cliente para impedir voto duplicado.

A restrição deverá ser reforçada pelas regras de segurança do Firebase. As Security Rules permitem validar a identidade autenticada e os dados submetidos antes de aceitar uma gravação.

---

# 17. Resultado da votação

Durante a votação:

```text
🟢 VOTAÇÃO ABERTA

87 participantes

Resultado oculto
```

O apresentador poderá escolher:

```text
[ Encerrar votação ]
```

Depois:

```text
[ Mostrar resultados ]
```

Somente então apresentar:

```text
VRRP          ███████████ 55%
GSLB          █████        27%
BGP Anycast   ███          18%
```

Por padrão, não exibir os resultados antes do encerramento.

Isso reduz o efeito de influência da maioria sobre quem ainda não votou.

---

# 18. Perguntas do público

O participante poderá enviar:

```text
❓ Enviar pergunta
```

Exemplo:

```text
Como seria o failover se os dois DCs
perderem conectividade?
```

A pergunta deverá entrar em uma fila de moderação.

---

# 19. Moderação

As perguntas não deverão aparecer diretamente na tela principal.

Fluxo:

```text
Participante
      ↓
Pergunta
      ↓
Firebase
      ↓
Fila de moderação
      ↓
Apresentador
      │
      ├── Aprovar
      ├── Ignorar
      └── Destacar
      ↓
Tela da apresentação
```

---

# 20. Controle de interações

O apresentador deverá controlar individualmente:

```text
Votação       🟢 Aberta
Perguntas     🟡 Moderação
Reações       🔴 Desativadas
Quiz          🔴 Desativado
```

Cada recurso deverá possuir estado próprio.

---

# 21. Proteção contra abuso

A autenticação reduz o risco, mas não deve ser considerada proteção absoluta.

Uma pessoa ainda pode possuir múltiplas contas.

Por isso deverão existir camadas adicionais:

### 21.1 Autenticação

Somente usuários autenticados poderão votar.

### 21.2 Um voto por usuário

Uma conta não poderá votar duas vezes na mesma enquete.

### 21.3 Rate limiting

Limitar quantidade de operações por usuário/sessão.

Exemplo:

```text
Votos:
1 por enquete

Perguntas:
máximo 2 por minuto

Reações:
limite por intervalo
```

### 21.4 Sessão

Cada apresentação terá uma sessão específica.

### 21.5 Encerramento

Após o encerramento, novas interações deverão ser recusadas.

### 21.6 Moderação

Perguntas deverão ser moderadas.

### 21.7 Detecção de comportamento anormal

Identificar padrões como:

```text
30 perguntas
em 20 segundos
```

ou volume anormal de requisições.

---

# 22. Bloqueio

O apresentador/admin deverá poder bloquear uma sessão/usuário.

Exemplo:

```text
Participante #83

Atividade suspeita

[ Bloquear ]
```

O bloqueio deverá impedir novas interações na apresentação.

O bloqueio não deverá depender somente do frontend.

---

# 23. Segurança do Firebase

As regras do Realtime Database deverão seguir o princípio:

```text
Público:
read limitado

Participante autenticado:
read + writes específicos

Apresentador:
controle da apresentação

Administrador:
controle total
```

As Security Rules deverão impedir que participantes alterem:

```text
currentSlide
pollStatus
showResults
slideContent
pollDefinition
results
```

diretamente.

O Firebase recomenda utilizar autenticação combinada com Security Rules para controlar acesso por usuário e validar os dados gravados.

---

# 24. Exemplo conceitual de autorização

```text
Audience
   │
   ├── READ presentation
   ├── READ currentSlide
   ├── READ audienceContent
   │
   ├── WRITE vote
   └── WRITE question

Presenter
   │
   ├── WRITE currentSlide
   ├── WRITE pollStatus
   ├── READ votes
   ├── READ questions
   └── WRITE moderation

Admin
   │
   └── gerenciamento completo
```

---

# 25. Estrutura de dados

Estrutura sugerida:

```text
presentations
│
└── presentationId
    │
    ├── metadata
    │
    ├── sessions
    │   └── sessionId
    │       ├── currentSlide
    │       ├── status
    │       ├── activePoll
    │       └── showResults
    │
    ├── slides
    │   ├── slide01
    │   ├── slide02
    │   └── slide03
    │
    ├── polls
    │   ├── poll01
    │   └── poll02
    │
    ├── votes
    │   └── pollId
    │       └── uid
    │
    ├── questions
    │   └── questionId
    │
    └── participants
        └── uid
```

---

# 26. Participantes

Registrar somente informações necessárias.

Exemplo:

```javascript
{
    uid: "...",
    sessionId: "...",
    authenticatedAt: "...",
    lastActivity: "..."
}
```

Não armazenar nome ou e-mail no banco de participação se não houver necessidade funcional.

Quando necessário, os dados de autenticação deverão permanecer sob o controle do Firebase Authentication.

---

# 27. Interface do apresentador

Deverá possuir:

### Navegação

```text
← Anterior
→ Próximo
Ir para slide
```

### Interações

```text
Abrir votação
Encerrar votação
Mostrar resultados
Ocultar resultados
Abrir perguntas
Fechar perguntas
```

### Monitoramento

```text
Backend: 🟢 Online
Participantes: 87
Votação: 🟢 Aberta
Perguntas pendentes: 4
```

---

# 28. Interface do participante

Menu mínimo:

```text
Apresentação

• Slide atual
• Conteúdo complementar
• Diagramas
• Materiais
• Votação
• Perguntas
```

O conteúdo deverá ser responsivo para smartphones.

---

# 29. Modo "acompanhar apresentação"

O participante deverá acompanhar automaticamente o slide atual.

Exemplo:

```text
Apresentador:
Slide 8
```

O smartphone:

```text
🔴 AO VIVO

Slide 8

Arquitetura de segurança

[Conteúdo complementar]
```

Quando o apresentador mudar:

```text
Slide 9
```

o smartphone deverá atualizar automaticamente.

---

# 30. Exploração complementar

O participante poderá consultar:

- detalhes técnicos;
- diagramas;
- documentação;
- glossário;
- referências;
- links;
- vídeos;
- imagens;
- notas técnicas.

Esses recursos não deverão alterar o slide atual da apresentação.

---

# 31. Arquitetura de arquivos

Estrutura inicial:

```text
/
├── presenter/
│   ├── index.html
│   ├── presenter.js
│   └── presenter.css
│
├── audience/
│   ├── index.html
│   ├── audience.js
│   └── audience.css
│
├── admin/
│   ├── index.html
│   ├── admin.js
│   └── admin.css
│
├── shared/
│   ├── firebase.js
│   ├── auth.js
│   ├── database.js
│   ├── security.js
│   └── utils.js
│
├── content/
│   ├── presentations/
│   └── slides/
│
├── assets/
│   ├── images/
│   ├── diagrams/
│   └── documents/
│
├── firebase.json
├── database.rules.json
├── package.json
└── README.md
```

---

# 32. Separação dos componentes

A aplicação deverá ser modular.

## Presentation Engine

Responsável pela apresentação.

## Audience Engine

Responsável pelo smartphone.

## Authentication Engine

Responsável pelo login.

## Realtime Engine

Responsável pela sincronização.

## Interaction Engine

Responsável por:

- votação;
- quiz;
- perguntas;
- reações.

## Moderation Engine

Responsável por controlar conteúdo enviado pelo público.

## Content Engine

Responsável pelo conteúdo dos slides.

## Administration Engine

Responsável pelo gerenciamento das apresentações.

---

# 33. Backend recomendado

Primeira implementação:

```text
Firebase Hosting
        +
Firebase Authentication
        +
Firebase Realtime Database
```

Firebase deverá ser escolhido inicialmente pela integração direta entre autenticação, banco em tempo real e aplicação web.

As Security Rules do Realtime Database são aplicadas no servidor e controlam leitura, escrita e validação dos dados.

---

# 34. Não utilizar inicialmente

Não implementar na primeira versão:

- aplicativo Android;
- aplicativo iOS;
- backend próprio;
- servidor dedicado;
- banco SQL;
- Kubernetes;
- microserviços;
- infraestrutura complexa;
- login obrigatório para leitura;
- múltiplos provedores de autenticação simultaneamente.

A primeira versão deverá ser simples.

---

# 35. Fases de desenvolvimento

## Fase 1 — Apresentação

Implementar:

- HTML;
- CSS;
- JavaScript;
- navegação;
- slides;
- conteúdo complementar;
- QR Code.

---

# 36. Fase 2 — Backend

Implementar:

- Firebase;
- criação de sessão;
- estado da apresentação;
- sincronização do slide;
- status da sessão.

Resultado:

```text
Apresentador muda slide
        ↓
Firebase
        ↓
Smartphones atualizam
```

---

# 37. Fase 3 — Autenticação

Implementar:

- Firebase Authentication;
- Google Login;
- identificação por UID;
- sessão do participante;
- controle de acesso.

O conteúdo continuará disponível sem login.

A autenticação será necessária para:

```text
votar
perguntar
quiz
reações
```

---

# 38. Fase 4 — Votação

Implementar:

- criação de enquete;
- abertura;
- votação;
- prevenção de voto duplicado;
- encerramento;
- cálculo de resultado;
- apresentação dos resultados.

---

# 39. Fase 5 — Moderação

Implementar:

- perguntas;
- fila;
- aprovação;
- rejeição;
- destaque;
- bloqueio;
- encerramento.

---

# 40. Fase 6 — Proteção contra abuso

Implementar:

- rate limiting;
- limites de perguntas;
- limites de reações;
- controle de sessão;
- detecção de comportamento anormal;
- bloqueio.

---

# 41. Fase 7 — Administração

Implementar:

- criação de apresentação;
- edição de slides;
- cadastro de conteúdo;
- criação de votações;
- gerenciamento de sessões;
- gerenciamento de usuários/apresentadores.

---

# 42. Fase 8 — Analytics

Implementar posteriormente:

```text
Participantes
Participação por slide
Votos
Taxa de participação
Perguntas
Tempo de participação
Interações
```

Possibilitar exportação dos resultados.

---

# 43. Fase 9 — Novos provedores

Adicionar:

```text
Microsoft
Microsoft Entra ID
```

Especialmente para utilização corporativa.

---

# 44. Modo de autenticação

O sistema deverá possuir configuração por apresentação:

```text
authenticationMode

public
google
microsoft
entra
```

Exemplo:

### Palestra aberta

```text
Leitura: livre
Votação: Google
Perguntas: Google
```

### Reunião corporativa

```text
Leitura: livre
Votação: Entra ID
Perguntas: Entra ID
```

---

# 45. Votação formal

Para votações que tenham valor decisório, não considerar apenas login social como mecanismo suficiente de garantia de identidade.

Criar futuramente um modo:

```text
FORMAL
```

com:

- autenticação corporativa;
- controle de domínio;
- auditoria;
- regras específicas;
- registro de participação;
- possibilidade de validação posterior.

O modo normal de apresentação deverá ser considerado uma ferramenta de interação, e não um sistema eleitoral ou mecanismo formal de deliberação.

---

# 46. Performance

A primeira versão deverá suportar pelo menos:

```text
100 participantes simultâneos
```

A arquitetura deverá permitir expansão posterior.

Priorizar:

- listeners em tempo real;
- dados pequenos;
- conteúdo estático em cache;
- imagens otimizadas;
- atualizações incrementais.

---

# 47. Contingência

Se a conexão do apresentador cair:

```text
🔴 Backend desconectado
```

O apresentador deverá continuar navegando localmente.

A aplicação deverá indicar:

```text
Modo local / não sincronizado
```

As funções dependentes do backend deverão ser desabilitadas ou identificadas.

---

# 48. QR Code e contingência

O painel deverá sempre exibir:

```text
QR CODE

Participação:
https://...
```

Também deverá existir um código curto:

```text
Código:
A8F3K2
```

para permitir entrada manual caso o QR Code não funcione.

---

# 49. Segurança

A aplicação deverá considerar:

- autenticação;
- autorização;
- Security Rules;
- validação de entrada;
- proteção contra voto duplicado;
- rate limiting;
- moderação;
- controle de sessão;
- bloqueio;
- encerramento de sessão.

Não confiar exclusivamente na validação JavaScript do navegador.

---

# 50. Critérios de aceitação

## Apresentador

- [ ] Abrir apresentação.
- [ ] Navegar entre slides.
- [ ] Exibir QR Code.
- [ ] Criar/iniciar sessão.
- [ ] Ver participantes.
- [ ] Abrir votação.
- [ ] Encerrar votação.
- [ ] Mostrar resultados.
- [ ] Receber perguntas.
- [ ] Moderar perguntas.
- [ ] Bloquear participante.
- [ ] Encerrar sessão.

## Público

- [ ] Escanear QR Code.
- [ ] Acessar apresentação sem login.
- [ ] Ver slide atual.
- [ ] Ver conteúdo complementar.
- [ ] Acompanhar mudança de slide.
- [ ] Fazer login Google quando necessário.
- [ ] Votar.
- [ ] Não conseguir votar duas vezes.
- [ ] Enviar pergunta.
- [ ] Receber confirmação.
- [ ] Ver resultado quando liberado.

## Segurança

- [ ] Usuário não autenticado não pode votar.
- [ ] Usuário não autenticado não pode enviar perguntas.
- [ ] Usuário não pode alterar o slide atual.
- [ ] Usuário não pode alterar resultados.
- [ ] Usuário não pode alterar definição de votação.
- [ ] Voto duplicado deve ser rejeitado.
- [ ] Perguntas passam por moderação.
- [ ] Sessão encerrada não aceita novas interações.

---

# 51. Prompt principal para a IA do VS Code

Utilizar o texto abaixo como instrução inicial para desenvolvimento:

> Desenvolva uma plataforma de apresentação HTML interativa seguindo integralmente este plano de implantação.
>
> A aplicação deverá possuir três ambientes:
>
> 1. Presenter — interface do apresentador.
> 2. Audience — interface dos participantes.
> 3. Admin — gerenciamento futuro da plataforma.
>
> Utilize HTML5, CSS3 e JavaScript moderno, priorizando JavaScript Vanilla na primeira versão.
>
> Utilize Firebase como backend, inicialmente com:
>
> - Firebase Hosting;
> - Firebase Authentication;
> - Firebase Realtime Database.
>
> Utilize Google Authentication como primeiro provedor.
>
> A arquitetura deverá permitir posteriormente Microsoft e Microsoft Entra ID.
>
> O participante deverá conseguir acessar o conteúdo complementar da apresentação sem autenticação.
>
> Entretanto, para realizar qualquer interação que altere dados, como:
>
> - votação;
> - quiz;
> - pergunta;
> - reação;
>
> deverá autenticar-se.
>
> O apresentador não deverá visualizar nome ou e-mail do participante por padrão. A aplicação deverá trabalhar internamente com Firebase UID e identificadores técnicos de participação.
>
> Cada usuário autenticado poderá votar apenas uma vez em cada enquete.
>
> Essa restrição deverá ser implementada no backend através das Security Rules e/ou mecanismo server-side apropriado, não somente através de JavaScript no navegador.
>
> As perguntas deverão passar por moderação antes de aparecer na tela da apresentação.
>
> Implementar controle de sessão da apresentação.
>
> Cada sessão deverá possuir identificador próprio e deverá ser encerrada pelo apresentador.
>
> Após o encerramento, novas interações deverão ser recusadas.
>
> Implementar rate limiting e mecanismos básicos de detecção de comportamento anormal.
>
> Implementar arquitetura modular separando:
>
> - Presentation Engine;
> - Audience Engine;
> - Authentication Engine;
> - Realtime Engine;
> - Interaction Engine;
> - Moderation Engine;
> - Content Engine;
> - Administration Engine.
>
> O conteúdo dos slides deverá ser separado da lógica da aplicação.
>
> O sistema deverá possuir um QR Code único por sessão.
>
> O smartphone deverá acompanhar automaticamente o slide atualmente apresentado.
>
> Cada slide deverá possuir conteúdo específico para:
>
> - apresentador;
> - público.
>
> O conteúdo do público poderá conter:
>
> - textos adicionais;
> - diagramas;
> - imagens;
> - documentos;
> - links;
> - explicações;
> - referências.
>
> A primeira implementação deverá suportar pelo menos 100 participantes simultâneos.
>
> Desenvolva inicialmente as fases 1 a 4:
>
> 1. apresentação;
> 2. backend e sincronização;
> 3. autenticação;
> 4. votação.
>
> Depois implemente as fases seguintes somente após validar a arquitetura.
>
> Não implementar inicialmente aplicativo Android ou iOS.
>
> Não exigir login para leitura do conteúdo.
>
> Não implementar backend próprio na primeira versão.
>
> Criar README.md contendo:
>
> - arquitetura;
> - requisitos;
> - instalação;
> - configuração Firebase;
> - configuração Google Authentication;
> - regras de segurança;
> - execução local;
> - publicação;
> - criação de apresentação;
> - criação de sessão;
> - geração do QR Code;
> - utilização pelo apresentador;
> - utilização pelo público;
> - testes;
> - troubleshooting.
>
> Criar também testes para validar:
>
> - autenticação;
> - sincronização;
> - voto único;
> - tentativa de voto duplicado;
> - tentativa de alteração indevida do estado;
> - encerramento de sessão;
> - moderação;
> - controle de acesso.
>
> Antes de adicionar novas funcionalidades, mantenha a arquitetura modular e documente decisões técnicas importantes.

---

# 52. Resultado esperado

A experiência final deverá ser:

```text
                 APRESENTADOR
                      │
                      ▼
              ┌──────────────┐
              │ Slide atual  │
              └──────┬───────┘
                     │
                     ▼
                  Firebase
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        📱 João    📱 Maria    📱 Pedro
          │          │          │
          ▼          ▼          ▼
       Detalhes   Detalhes   Detalhes
          │          │          │
          └──────────┼──────────┘
                     ▼
                "Participar"
                     │
                     ▼
              Google Login
                     │
                     ▼
               Autorização
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
        Votar      Perguntar   Quiz
          │          │          │
          ▼          ▼          ▼
                Firebase
                     │
                     ▼
                Moderação
                     │
                     ▼
                Apresentador
```

A solução deverá buscar o seguinte equilíbrio:

**fácil para o público + simples para o apresentador + segura contra abuso + barata de operar + preparada para evolução.**

A autenticação social não deverá ser tratada como mecanismo infalível contra fraude. Ela deverá ser uma das camadas de controle, complementada por identificação de usuário, regras de backend, voto único, rate limiting, moderação e controle de sessão.