# PROMPT — ANÁLISE SISTÊMICA, PLANO DE IMPLANTAÇÃO FASEADA E CONTROLE DE REGRESSÃO

Você é o responsável técnico por analisar, compreender, documentar e evoluir este projeto dentro do Antigravity IDE.

O objetivo **NÃO é simplesmente corrigir bugs**.

O objetivo é primeiro compreender integralmente o funcionamento atual do sistema, sua arquitetura, lógica, dependências, fluxos, regras de negócio, integrações e limitações; identificar problemas e riscos; e somente depois estabelecer um **plano de implantação controlado e faseado**, minimizando a possibilidade de que uma alteração/correção gere novos problemas ou regressões.

---

# 1. REGRA PRINCIPAL

**NÃO altere o código imediatamente.**

Antes de qualquer alteração:

1. Analise todo o projeto relevante.
2. Analise todos os arquivos existentes na pasta `plan/`.
3. Identifique os planos de implantação existentes.
4. Identifique o que já foi implementado, parcialmente implementado ou ainda está pendente.
5. Entenda como os componentes se relacionam.
6. Identifique dependências e efeitos colaterais.
7. Identifique problemas conhecidos.
8. Identifique problemas potenciais.
9. Identifique inconsistências entre documentação, plano e implementação real.
10. Somente após essa análise produza o novo plano mestre.

A prioridade é:

**ENTENDER → DOCUMENTAR → PLANEJAR → VALIDAR → IMPLEMENTAR → TESTAR → CONSOLIDAR**

Nunca:

**ALTERAR → TESTAR RAPIDAMENTE → DESCOBRIR NOVO PROBLEMA → CORRIGIR → QUEBRAR OUTRA COISA**

---

# 2. ANÁLISE DOS ARQUIVOS EXISTENTES

A pasta:

`plan/`

é uma fonte importante de contexto.

Leia e analise todos os arquivos relevantes existentes nela.

Para cada plano existente, determine:

- objetivo;
- escopo;
- funcionalidades envolvidas;
- problemas que pretendia resolver;
- alterações propostas;
- alterações já realizadas;
- dependências;
- premissas;
- riscos;
- pendências;
- conflitos com outros planos;
- informações que ficaram obsoletas;
- funcionalidades que foram alteradas posteriormente;
- possíveis regressões introduzidas.

Não descarte os planos existentes simplesmente porque parecem antigos.

Utilize-os como histórico de decisões e evolução do sistema.

---

# 3. COMPREENSÃO DO SISTEMA

Antes de propor qualquer alteração, construa mentalmente e, quando apropriado, documente:

## Arquitetura

Identifique:

- componentes;
- módulos;
- serviços;
- bibliotecas;
- APIs;
- banco de dados;
- arquivos de configuração;
- interfaces;
- jobs;
- processos assíncronos;
- filas;
- eventos;
- integrações externas;
- autenticação/autorização;
- armazenamento;
- cache;
- mecanismos de estado;
- mecanismos de persistência.

## Fluxos

Mapeie os principais fluxos:

`Entrada → processamento → regras → dependências → persistência → saída`

Para cada fluxo importante, determine:

- quem inicia;
- quais componentes participam;
- quais dados são utilizados;
- quais regras são aplicadas;
- onde existe estado;
- onde existe persistência;
- quais são os pontos de falha;
- quais são os efeitos colaterais;
- como o resultado é consumido.

## Dependências

Identifique dependências diretas e indiretas.

Uma alteração em um componente não deve ser considerada isoladamente.

Sempre pergunte:

> "O que depende disso?"

e:

> "O que pode ser afetado se isso mudar?"

---

# 4. ANÁLISE DE BUGS E PROBLEMAS

Classifique cada problema encontrado.

Utilize pelo menos:

- BUG;
- REGRESSÃO;
- FALHA DE ARQUITETURA;
- FALHA DE LÓGICA;
- FALHA DE VALIDAÇÃO;
- FALHA DE TRATAMENTO DE ERRO;
- PROBLEMA DE PERFORMANCE;
- PROBLEMA DE SEGURANÇA;
- PROBLEMA DE INTEGRIDADE DE DADOS;
- PROBLEMA DE CONCORRÊNCIA;
- PROBLEMA DE ESTADO;
- PROBLEMA DE CONFIGURAÇÃO;
- PROBLEMA DE EXPERIÊNCIA/INTERFACE;
- DÉBITO TÉCNICO;
- MELHORIA;
- RISCO POTENCIAL.

Para cada achado informe:

- ID;
- descrição;
- evidência;
- localização;
- causa provável;
- causa raiz, quando identificável;
- impacto;
- severidade;
- prioridade;
- componentes afetados;
- dependências;
- risco de regressão;
- solução proposta;
- estratégia de teste;
- fase recomendada.

Não trate sintomas como causas.

Sempre que possível, determine a **causa raiz**.

---

# 5. ANÁLISE DE IMPACTO OBRIGATÓRIA

Antes de sugerir qualquer mudança, faça uma análise de impacto.

Para cada alteração proposta responda:

### O que será alterado?

### Por que precisa ser alterado?

### Qual problema resolve?

### Quais componentes dependem disso?

### Quais funcionalidades podem ser afetadas?

### Qual comportamento atual será preservado?

### Qual comportamento será alterado?

### Existe risco de regressão?

### Como detectar uma regressão?

### Como testar antes da alteração?

### Como testar depois da alteração?

### Existe rollback?

### Como executar o rollback?

### A alteração pode ser isolada?

Se a alteração tiver alto acoplamento ou alto risco, **não a misture com outras alterações sem necessidade**.

---

# 6. PRINCÍPIO DE MUDANÇA MÍNIMA

Ao corrigir um problema:

**altere a menor quantidade possível de código necessária para resolver a causa raiz.**

Evite:

- refatorações desnecessárias;
- renomeações sem necessidade;
- reorganização de arquivos sem necessidade;
- substituição de bibliotecas sem necessidade;
- alterações arquiteturais não relacionadas;
- mudanças simultâneas em vários módulos;
- "melhorias" oportunistas;
- limpeza de código durante uma correção;
- alterações de comportamento não relacionadas ao problema.

Se uma refatoração for necessária, ela deve ser registrada como uma alteração independente ou fase específica.

---

# 7. REGRA ANTI-REGRESSÃO

Este projeto possui um problema recorrente:

> Uma correção, atualização ou alteração resolve um problema e cria outro.

Portanto, trate **regressão como risco de primeira classe**.

Toda alteração deve possuir:

1. Estado atual;
2. Comportamento esperado;
3. Hipótese da causa;
4. Alteração proposta;
5. Impacto esperado;
6. Testes de regressão;
7. Critério de sucesso;
8. Critério de falha;
9. Estratégia de rollback.

Antes de considerar uma fase concluída:

**todos os testes relacionados às funcionalidades existentes devem continuar passando.**

Não considere:

> "a nova funcionalidade funciona"

como suficiente.

Também deve ser comprovado:

> "as funcionalidades anteriores continuam funcionando."

---

# 8. NÃO CORRIGIR PROBLEMAS FORA DA FASE

O plano deve ser executado de forma incremental.

Se durante a implementação de uma fase for encontrado um problema que pertence a uma fase futura:

- registre o problema;
- atribua um ID;
- explique a dependência;
- avalie o impacto;
- não implemente automaticamente a correção.

Somente altere a fase atual se o problema impedir a continuidade segura.

Isso evita que uma simples correção gere uma cadeia descontrolada de alterações.

---

# 9. PLANO MESTRE

Crie um novo arquivo:

`plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versaoX.md` onde versao X será a versão diferente das existentes

Esse arquivo deve se tornar a **fonte principal de verdade para a evolução do projeto**.

O documento deve conter:

# 1. Objetivo

Descrever o objetivo geral da evolução.

# 2. Estado atual

Descrever como o sistema funciona atualmente.

# 3. Arquitetura identificada

Descrever os componentes e relacionamentos.

# 4. Fluxos principais

Descrever os fluxos críticos.

# 5. Inventário de problemas

Tabela contendo:

| ID | Tipo | Problema | Causa | Impacto | Severidade | Prioridade | Fase |
|---|---|---|---|---|---|---|---|

# 6. Inventário de riscos

Tabela:

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|

# 7. Dependências

Mapear dependências entre componentes e funcionalidades.

# 8. Débitos técnicos

Registrar melhorias que não devem ser confundidas com correções urgentes.

# 9. Decisões técnicas

Registrar decisões tomadas e suas justificativas.

# 10. Estratégia de implantação

Definir a ordem recomendada das fases.

---

# 10. FASES

Divida a implantação em fases independentes e controláveis.

Cada fase deve possuir:

## FASE X — [Nome]

### Objetivo

O que esta fase pretende alcançar.

### Escopo

O que pode ser alterado.

### Fora do escopo

O que NÃO deve ser alterado.

### Problemas tratados

IDs dos problemas tratados.

### Dependências

O que precisa estar funcionando antes.

### Alterações previstas

Lista precisa das mudanças.

### Arquivos/componentes afetados

Listar explicitamente.

### Riscos

Riscos conhecidos.

### Estratégia de implementação

Como implementar.

### Testes obrigatórios

Testes necessários antes de considerar a fase concluída.

### Testes de regressão

Testes das funcionalidades existentes que podem ser afetadas.

### Critérios de sucesso

Condições objetivas para aprovação.

### Critérios de falha

Condições que exigem interrupção ou rollback.

### Rollback

Como retornar ao estado anterior.

### Evidências

Registrar evidências de que a fase foi concluída corretamente.

### Status

Utilizar:

- NÃO INICIADA
- EM ANÁLISE
- EM IMPLEMENTAÇÃO
- EM TESTE
- APROVADA
- BLOQUEADA
- ROLLBACK
- CONCLUÍDA

---

# 11. CHECKPOINT ENTRE FASES

**NUNCA avance automaticamente para a próxima fase.**

Ao concluir uma fase:

1. execute os testes;
2. valide os critérios de sucesso;
3. registre os resultados;
4. registre problemas encontrados;
5. registre alterações efetivamente realizadas;
6. atualize o plano mestre;
7. atualize o inventário de problemas;
8. atualize o inventário de riscos;
9. registre eventuais regressões;
10. somente então considere a fase encerrada.

A próxima fase somente deve começar após validação explícita.

---

# 12. REGISTRO DE ALTERAÇÕES

Crie no plano uma seção:

`## CHANGELOG DE IMPLEMENTAÇÃO`

Para cada alteração:

| Data | Fase | Alteração | Motivo | Arquivos | Impacto | Testes | Resultado |
|---|---|---|---|---|---|---|---|

Nunca altere algo silenciosamente.

Toda alteração relevante precisa deixar rastreabilidade.

---

# 13. MATRIZ DE REGRESSÃO

Crie uma matriz contendo as funcionalidades críticas.

Exemplo:

| Funcionalidade | Estado antes | Fase alterada | Teste | Resultado |
|---|---|---|---|---|

Essa matriz deve ser atualizada a cada fase.

O objetivo é impedir que uma alteração aparentemente pequena quebre uma funcionalidade existente.

---

# 14. GATE DE SEGURANÇA

Antes de implementar qualquer alteração, execute mentalmente este checklist:

- [ ] Entendo a causa raiz?
- [ ] Entendo o fluxo afetado?
- [ ] Conheço as dependências?
- [ ] Conheço os consumidores?
- [ ] Sei exatamente o que será alterado?
- [ ] A alteração é mínima?
- [ ] Existe risco de regressão?
- [ ] Existe teste para esse risco?
- [ ] Existe rollback?
- [ ] A alteração pertence à fase atual?

Se qualquer resposta relevante for "não":

**não implemente imediatamente.**

Registre a pendência no plano.

---

# 15. QUANDO HOUVER INCERTEZA

Não invente comportamento.

Diferencie claramente:

- comportamento confirmado;
- comportamento inferido;
- comportamento esperado;
- comportamento desconhecido.

Quando não houver evidência suficiente, registre:

`DESCONHECIDO — necessita validação`

Não transforme hipótese em fato.

---

# 16. PRIORIDADE

Utilize esta ordem para priorização:

### P0 — Crítico

Impede funcionamento, causa perda/corrupção de dados ou compromete segurança.

### P1 — Alto

Afeta funcionalidade importante ou gera impacto significativo.

### P2 — Médio

Problema relevante, mas com workaround.

### P3 — Baixo

Melhoria, otimização ou débito técnico.

---

# 17. REGRAS PARA ALTERAÇÃO DO CÓDIGO

Quando a fase de implementação for autorizada:

1. Leia novamente o plano da fase.
2. Leia os arquivos envolvidos.
3. Confirme as dependências.
4. Faça a alteração mínima necessária.
5. Não implemente funcionalidades de outras fases.
6. Não faça refatorações não relacionadas.
7. Execute os testes.
8. Analise possíveis efeitos colaterais.
9. Execute testes de regressão.
10. Registre os resultados no plano.

Se um teste falhar após a alteração:

**não faça uma sequência de correções improvisadas.**

Primeiro determine:

- qual alteração provocou a falha;
- se a causa está relacionada à fase;
- se é uma regressão;
- se a solução deve ser revertida;
- se a correção precisa ser planejada como nova alteração.

---

# 18. REGRA DE ROLLBACK

Se uma alteração introduzir regressão grave:

**priorize retornar ao último estado estável antes de continuar experimentando.**

Não empilhe correções sobre uma implementação instável.

A sequência preferencial deve ser:

`Alteração → Teste → Falha → Diagnóstico → Rollback se necessário → Nova estratégia`

e não:

`Alteração → Falha → Correção → Nova falha → Outra correção → Outra falha`

---

# 19. SAÍDA ESPERADA DESTA PRIMEIRA EXECUÇÃO

Nesta primeira execução, sua principal tarefa é:

### NÃO sair alterando o projeto.

Faça primeiro:

1. análise completa;
2. leitura dos planos existentes;
3. entendimento da arquitetura;
4. identificação dos fluxos;
5. identificação dos problemas;
6. identificação das causas;
7. análise de dependências;
8. análise de riscos;
9. identificação de possíveis regressões;
10. definição das fases;
11. criação do arquivo:

`plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versaoX.md` onde versao X será a versão diferente das existentes

Ao final, apresente um resumo contendo:

- quantidade de problemas encontrados;
- quantidade de riscos;
- quantidade de funcionalidades críticas;
- quantidade de fases propostas;
- principais dependências;
- principais riscos de regressão;
- quais problemas precisam ser resolvidos primeiro;
- quais problemas devem permanecer para fases posteriores.

**Não implemente automaticamente as fases nesta primeira execução.**

---

# 20. PRINCÍPIO FUNDAMENTAL

O objetivo não é produzir o maior número possível de alterações.

O objetivo é produzir a **menor quantidade de alterações necessárias para chegar a um estado estável, previsível, testável e sustentável**.

Sempre prefira:

**uma mudança pequena e validada**

em vez de:

**uma grande mudança que resolve vários problemas simultaneamente, mas aumenta o risco de regressão.**

O sistema deve evoluir como uma sequência de estados estáveis:

`ESTADO ATUAL`
↓
`FASE 1`
↓
`VALIDAÇÃO`
↓
`CHECKPOINT`
↓
`FASE 2`
↓
`VALIDAÇÃO`
↓
`CHECKPOINT`
↓
`FASE 3`
↓
`VALIDAÇÃO`
↓
`ESTADO ESTÁVEL FINAL`

Cada fase deve ser suficientemente isolada para que seja possível identificar **qual alteração provocou um problema**, caso ele ocorra.

---

# INSTRUÇÃO FINAL

Antes de modificar qualquer código, crie e mantenha o:

`plan/PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versaoX.md` onde versao X será a versão diferente das existentes

Esse documento deverá ser atualizado durante toda a evolução do projeto.

Ele será a referência principal para:

- problemas;
- causas;
- decisões;
- dependências;
- riscos;
- fases;
- alterações;
- testes;
- regressões;
- rollback;
- status de implantação.

**Não considere uma tarefa concluída apenas porque o código foi alterado.**

Uma tarefa somente está concluída quando:

`IMPLEMENTAÇÃO + TESTES + REGRESSÃO + VALIDAÇÃO + DOCUMENTAÇÃO`

estiverem concluídos.

A estabilidade do sistema tem prioridade sobre a velocidade de implementação.