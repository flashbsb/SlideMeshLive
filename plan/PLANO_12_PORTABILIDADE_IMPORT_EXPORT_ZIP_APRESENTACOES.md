# PLANO 12 — Portabilidade Total: Exportação & Importação de Pacote ZIP de Apresentações (.zip / .slidemesh)

> **Identificador:** `DEMANDA-12-PORTABILIDADE-IMPORT-EXPORT-ZIP`  
> **Versão Alvo:** `v2.0.0`  
> **Status:** `PROPOSTO — AGUARDANDO APROVAÇÃO`  
> **Complexidade:** `Média`  
> **Impacto no Negócio:** `Crítico (Permite transferir apresentações completas com mídias e assets entre ambientes de desenvolvimento, homologação e palcos de produção sem dependência de internet ou Git)`  
> **Classificação Técnica:** `RECOMENDADO (OFFLINE-FIRST, ZERO LOSS & ZIP HARDENING)`

---

## 1. PARECER CRÍTICO & ANÁLISE DE VIABILIDADE

### 1.1 Resposta Direta à Pergunta do Usuário
**Atualmente, na página inicial (`index.html`) NÃO existe opção de exportar ou importar pacotes ZIP completos de apresentações.**
- O portal atual apenas lista as apresentações e abre o visualizador/admin.
- O importador existente (`import.html` / `tools/import_presentation.py`) converte apenas documentos brutos (`.pptx`, `.docx`, `.md`, `.pdf`), sem mecanismo de transporte de uma apresentação nativa já estruturada (com `manifest.json`, `slides.json`, temas, configurações de segurança e pasta `assets/` contendo imagens `.svg`, vídeos `.mp4`, etc.).

### 1.2 Por que a funcionalidade é essencial para o ecossistema SlideMeshLive?
1. **Cenário Real de Produção (Air-Gapped / Palco Offline):**
   - Um palestrante ou equipe de design monta e calibra a apresentação no seu laptop de trabalho (com vídeos, gráficos, enquetes e notas de orador).
   - No dia do evento, a máquina do palco / servidor local de produção pode estar em uma rede isolada sem acesso à internet ou sem acesso aos repositórios de código.
   - O operador precisa apenas exportar `minha-apresentacao.slidemesh.zip` num pendrive, abrir a Home (`index.html`) do servidor do palco, clicar em **"Importar Pacote ZIP"** e a apresentação fica imediatamente disponível para a mesa técnica, telão e smartphones da plateia.
2. **Preservação Não-Destrutiva do Catálogo:**
   - A importação da apresentação X em um ambiente que já possui as apresentações Y e Z **não deve apagar nem corromper** as apresentações existentes em `presentations/catalog.json`.
3. **Gestão Inteligente de Conflitos de Slug/ID:**
   - Caso o ambiente de destino já possua uma apresentação com o mesmo ID, o sistema deve fornecer opções claras e seguras:
     - **Substituir / Atualizar:** Atualiza a versão existente preservando integridade.
     - **Criar Nova Cópia:** Renomeia automaticamente o slug (ex: `sdwan-cpe-unificado-copia`) para manter ambas as versões ativas.

---

## 2. ARQUITETURA DA SOLUÇÃO TÉCNICA

### 2.1 Estrutura do Pacote Portátil de Apresentação (`.slidemesh.zip` ou `.zip`)

```text
📦 pacote-apresentacao.slidemesh.zip
├── manifest.json       (Metadados: id, título, sessão padrão, tema, segurança PIN/pública)
├── slides.json         (Conteúdo de todos os slides: presenter, audience, enquetes, notas)
└── assets/             (Imagens SVG/PNG/WebP, vídeos MP4/WebM, áudios MP3)
    ├── diagram-1.svg
    ├── video-intro.mp4
    └── logo-partner.png
```

### 2.2 Fluxo de Exportação & Importação

```text
┌────────────────────────────────┐                 ┌────────────────────────────────┐
│      Ambiente de Origem        │                 │     Ambiente de Destino        │
│   (Laptop do Palestrante)      │                 │     (Servidor do Palco)        │
├────────────────────────────────┤                 ├────────────────────────────────┤
│ 1. Clica em "Exportar ZIP" no  │                 │ 3. Acessa Home (index.html)    │
│    card da apresentação        │                 │ 4. Clica em "Importar ZIP" ou  │
│ 2. Backend gera e envia o      │  ────────────►  │    arrasta o arquivo para tela │
│    arquivo .slidemesh.zip      │     Pendrive    │ 5. Backend valida Zip Slip,    │
│    via GET /api/presentations/ │    / E-mail     │    descompacta assets e mescla │
│    export?id={slug}            │                 │    em catalog.json             │
└────────────────────────────────┘                 └────────────────────────────────┘
```

### 2.3 Matriz de Segurança e Proteção Obrigatória (Hardening de ZIP)

| Vetor de Ataque / Risco | Mecanismo de Prevenção & Hardening Implementado |
|---|---|
| **Zip Slip (Path Traversal)** | Validação estrita de cada entrada no arquivo ZIP com `os.path.abspath` e `os.path.commonpath`, garantindo que nenhum arquivo seja gravado fora de `presentations/{slug}/`. |
| **Zip Bomb (DoS por Descompressão)** | Limite de tamanho total descompactado (máximo 200MB) e limite do total de arquivos (máximo 500 arquivos). Rejeição com HTTP 400/413 caso exceda. |
| **Injeção de Executáveis Maliciosos** | Lista estrita de extensões permitidas dentro de `assets/` (`.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav`, `.m4a`). Rejeição imediata de `.sh`, `.exe`, `.js`, `.py`, `.php`, `.bat` ou arquivos ocultos. |
| **Corrupção de Catálogo Concorrente** | Uso obrigatório do lock reentrante de estado `_STATE_LOCK` do `server.py` e gravação com arquivo temporário `.tmp` e `os.replace`. |

---

## 3. ESCOPO DETALHADO POR COMPONENTE

### 3.1 Backend (`server.py` & CLI Python)
1. **Endpoint `GET /api/presentations/export?id={slug}`:**
   - Valida a existência do diretório `presentations/{slug}`.
   - Gera um ZIP em memória (`io.BytesIO` e `zipfile.ZipFile`) contendo `manifest.json`, `slides.json` e todos os arquivos em `assets/`.
   - Retorna cabeçalhos `Content-Type: application/zip`, `Content-Disposition: attachment; filename="{slug}.slidemesh.zip"`.
2. **Endpoint `POST /api/presentations/import-zip`:**
   - Recebe o arquivo ZIP enviado via multipart/form-data ou payload binário/base64.
   - Suporta parâmetro opcional `mode=overwrite|rename` (padrão: `overwrite`).
   - Valida schemas do `manifest.json` e `slides.json` extraídos.
   - Extrai assets para `presentations/{slug}/assets/`.
   - Atualiza `presentations/catalog.json` de forma atômica e não-destrutiva (adiciona a nova entrada ou atualiza a existente).
   - Retorna payload detalhado com URLs do Telão, Mesa Técnica e Audience.
3. **Utilitário CLI `tools/export_presentation.py` [NOVO]:**
   - Permite exportar apresentações via terminal: `python3 tools/export_presentation.py <slug> [saida.zip]`.
4. **Atualização do CLI `tools/import_presentation.py`:**
   - Suporte nativo a arquivos `.zip` / `.slidemesh.zip` diretamente na linha de comando: `python3 tools/import_presentation.py pacote.zip`.

### 3.2 Frontend Portal (`index.html`):
1. **Botão de Exportação nos Cards:**
   - Em cada card da grade (`#catalog-cards-container`), adicionar o botão **📦 Exportar ZIP** (`${i18n.t('portal.btn_export_zip')}`).
2. **Botão e Modal de Importação ZIP no Cabeçalho:**
   - Botão **📦 Importar Pacote ZIP** na barra de navegação superior.
   - Modal com **Área de Drag & Drop** para soltar o arquivo `.zip` ou `.slidemesh.zip`.
   - Detecção automática de conflito caso o ID já exista, exibindo diálogo para escolher entre **Sobrescrever** ou **Importar como Cópia**.
   - Atualização dinâmica da grade de apresentações sem necessidade de recarregar a página (*refresh* suave).

### 3.3 Frontend SlideMesh Studio (`import.html`):
1. Adicionar card/aba **"Pacote SlideMesh (.zip)"** na seção de importação.
2. Adicionar botão **"📦 Exportar Pacote ZIP"** na barra de ferramentas do Studio para baixar o projeto em edição a qualquer momento.

### 3.4 Mesa Técnica (`admin/index.html` & `admin-app.js`):
1. Adicionar botão de download do pacote de backup no menu da Mesa Técnica: **"📦 Exportar Pacote desta Apresentação (.zip)"**.

### 3.5 Internacionalização (`js/core/i18n-engine.js`):
- Chaves simétricas em `pt-BR` e `en-US` para botões, tooltips, modais de conflito e mensagens de sucesso/erro.

---

## 4. FASES DE IMPLEMENTAÇÃO

### 🔹 Fase 1: Backend de Exportação & Importação ZIP (`server.py` & CLIs)
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA COM TESTES AUTOMATIZADOS (Suíte 23)`
- Implementação do endpoint `GET /api/presentations/export?id={slug}` com geração em memória e streaming de arquivos `.slidemesh.zip`.
- Implementação do endpoint `POST /api/presentations/import-zip` com suporte a binário direto e JSON Base64, e hardening contra Zip Slip e Zip Bomb.
- Criação do utilitário CLI `tools/export_presentation.py` e atualização do `tools/import_presentation.py`.
- Atualização atômica de `presentations/catalog.json` sem apagar apresentações pré-existentes.

### 🔹 Fase 2: Interface do Portal (`index.html`) & Modais de Import/Export
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA COM TESTES AUTOMATIZADOS (Suíte 23)`
- Botões de **📦 Exportar ZIP** adicionados aos cards de apresentações ativas com download streaming direto.
- Botão **📦 Importar ZIP** no cabeçalho e no card de novas apresentações.
- Modal com **Área de Drag & Drop** para soltar arquivos `.zip` ou `.slidemesh`.
- Caixa de diálogo para **Resolução de Conflitos** (Sobrescrever vs Importar como Nova Cópia).
- Feedback visual de status e recarregamento reativo do catálogo na grade sem necessidade de recarregar a página.
- Internacionalização completa em `pt-BR` e `en-US` no `i18n-engine.js`.

### 🔹 Fase 3: Integração no SlideMesh Studio (`import.html`) e Mesa Técnica (`admin/index.html`)
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA COM TESTES AUTOMATIZADOS (Suíte 23)`
- Suporte a arrastar e soltar pacotes `.zip` e `.slidemesh` no SlideMesh Studio (`import.html`) com descompressão atômica e carregamento instantâneo no editor (Etapa 2).
- Botões de exportação **"📦 Exportar ZIP"** adicionados no cabeçalho e na barra de configuração da Etapa 2 do Studio (`import.html`).
- Botão **"📦 Baixar Pacote Completo (.zip)"** (`#admin-btn-export-zip`) integrado na Mesa Técnica (`admin/index.html` e `admin-app.js`) com download streaming com 1 clique.
- Chaves de internacionalização `admin.export_deck_zip` e `import.btn_export_zip` sincronizadas em `pt-BR` e `en-US`.

### 🔹 Fase 4: Testes Automatizados, Documentação e Homologação Final
- **Status:** `CONCLUÍDA — 100% HOMOLOGADA COM TESTES AUTOMATIZADOS (Suíte 23)`
- **Suíte 23** criada e validada em `scratch/test_suite.py` cobrindo:
  - Exportação e integridade do ZIP gerado (`GET /api/presentations/export`).
  - Importação em ambiente com apresentações existentes com preservação do catálogo (`POST /api/presentations/import-zip`).
  - Testes de segurança contra Zip Slip (`HTTP 403`) e Zip Bomb (200MB).
  - Teste de resolução de conflito de slug (`mode=overwrite` e `mode=rename`).
  - Teste dos utilitários CLI (`tools/export_presentation.py` e `tools/import_presentation.py`).
  - Testes de interface no `index.html`, `import.html` e `admin/index.html`.
- Documentação oficial consolidada em `README.pt-BR.md`, `README.md` e `PLANO_MESTRE_ANALISE_E_IMPLANTACAO_versao3.md`.

---

## 5. CRITÉRIOS DE ACEITE E SUCESSO

1. [x] Uma apresentação completa com mídias e assets é exportada em um único arquivo `.zip` com 1 clique.
2. [x] O arquivo `.zip` exportado pode ser importado em uma instância limpa ou existente do SlideMeshLive, registrando a apresentação no catálogo sem apagar as outras.
3. [x] Proteção completa contra Zip Slip e Zip Bomb validada por testes automatizados.
4. [x] Interface amigável e responsiva no `index.html`, `import.html` e `admin/index.html`.
5. [x] 100% dos testes automatizados aprovados (23/23 suítes).
