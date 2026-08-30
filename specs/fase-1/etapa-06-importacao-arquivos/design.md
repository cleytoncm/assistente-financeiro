# Design — Importação de Arquivos

## Modelo de dados

```
ImportBatch (lote de importação)
  id, user_id (FK User),
  format (ENUM 'ofx'|'csv'|'pdf_invoice'),
  account_id (FK Account, NULLABLE), card_id (FK Card, NULLABLE),
  mode (ENUM 'staged'|'direct'),
  status (ENUM 'processando'|'aguardando_revisao'|'concluido'|'falhou'),
  file_hash (CHAR(64)),                    -- SHA-256 hex do arquivo original
  raw_content (BYTEA, NULLABLE),           -- conteúdo temporário; nulo fora da janela de processamento
  error_message (TEXT, NULLABLE),          -- preenchido só se status='falhou'
  created_at, processed_at (NULLABLE)
  CHECK: exatamente um entre account_id e card_id
  CHECK: format='pdf_invoice' implica card_id preenchido; format IN ('ofx','csv') implica account_id preenchido

ImportedRow (linha extraída de um lote)
  id, import_batch_id (FK ImportBatch),
  date (DATE), description (TEXT), amount (DECIMAL(12,2)),
  external_id (VARCHAR, NULLABLE),                    -- FITID, só para OFX
  is_duplicate_suspect (BOOLEAN, default false),
  duplicate_of_transaction_id (FK Transaction, NULLABLE),
  suggested_category_id (FK Category, NULLABLE),
  resolution (ENUM 'pendente'|'aceita'|'descartada', default 'pendente'),
  created_transaction_id (FK Transaction, NULLABLE, UNIQUE),
  created_at

Transaction (Etapa 3, alterada nesta etapa)
  ... campos já existentes ...
  external_id (VARCHAR, NULLABLE)          -- FITID, preenchido só quando veio de import OFX
  import_batch_id (FK ImportBatch, NULLABLE) -- rastreabilidade: de qual lote essa transaction veio
  UNIQUE(account_id, external_id) WHERE external_id IS NOT NULL AND account_id IS NOT NULL
  UNIQUE(card_id, external_id) WHERE external_id IS NOT NULL AND card_id IS NOT NULL
```

Notas:
- `ImportedRow` é criado para **toda** linha extraída, mesmo no modo `direct` com aceitação
  automática — é o que garante histórico auditável do lote inteiro (ver "Decisões confirmadas"
  em requirements.md). Uma duplicata **exata** (RF-04) não gera `ImportedRow` nenhuma — é
  descartada antes mesmo de virar linha, já que não há nenhuma decisão do usuário envolvida.
- `raw_content` só existe fisicamente durante a janela entre o upload e o fim do processamento
  (sucesso ou falha) — o handler de processamento sempre grava `NULL` nesse campo ao terminar,
  independente do resultado.

## Fluxo de upload e processamento (RF-01, RF-02)

```
POST /import-batches   (multipart: file + format + account_id|card_id + mode)
  1. valida tamanho (limite 10 MB) e formato do arquivo
  2. calcula file_hash (SHA-256)
  3. se existe ImportBatch do mesmo usuário com mesmo file_hash e status='concluido':
     - sem confirmDuplicateFile=true no corpo: responde 409 com data do import anterior
     - com confirmDuplicateFile=true: segue normalmente
  4. cria ImportBatch (status='processando', raw_content=conteúdo do arquivo)
  5. enfileira job no Cloud Tasks com { importBatchId }
  6. responde 202 { id, status: 'processando' }

POST /internal/import-batches/:id/process   (chamado só pelo Cloud Tasks)
  - protegido por validação do token OIDC anexado pelo Cloud Tasks (mesmo racional da validação
    de secret do webhook do Telegram, constitution.md)
  1. carrega o ImportBatch e seu raw_content
  2. despacha para o extrator do formato (ver seção seguinte)
  3. se a extração falhar (qualquer linha não interpretável): status='falhou', error_message
     preenchido, raw_content=NULL, encerra (RF-07 — sem processamento parcial)
  4. para cada lançamento extraído: roda detecção de duplicata (RF-04) e sugestão de categoria
     (RF-05), cria ImportedRow (ou nada, se duplicata exata) e, se aplicável ao modo, cria a
     Transaction imediatamente (ver "Resolução por linha" abaixo)
  5. status final: 'concluido' se não sobrou nenhuma ImportedRow com resolution='pendente';
     caso contrário 'aguardando_revisao'
  6. raw_content=NULL sempre, nesse ponto
```

## Extração por formato (RF-03)

- **OFX**: parser determinístico (biblioteca de parsing OFX) sobre `raw_content` — retorna lista
  de `{ date, description, amount, external_id }` (FITID vira `external_id`)
- **CSV**: `raw_content` (texto) enviado a um modelo Gemini (Vertex AI) com instrução de extrair
  `{ date, description, amount }` por linha, em formato de saída estruturado (JSON Schema) —
  sem `external_id` (CSV não carrega esse dado)
- **PDF de fatura**: `raw_content` (bytes do PDF) enviado diretamente ao modelo Gemini (input
  multimodal de documento), mesma instrução/schema de saída que o CSV, sem `external_id`
- Qualquer falha na chamada ao modelo (indisponibilidade, resposta fora do schema esperado) ou
  qualquer linha com `date`/`amount` inválidos após a extração conta como falha do lote (RF-07)

## Detecção de duplicata (RF-04)

```
function detectDuplicate(row, destination):   -- destination = { account_id } ou { card_id }
  if row.external_id is not null:
    if exists Transaction with destination and external_id = row.external_id:
      return 'exact'
  if exists Transaction with destination and date = row.date and amount = row.amount:
    return 'suspect'
  return 'none'
```

## Sugestão de categoria (RF-05)

```
function suggestCategory(userId, description):
  normalized = normalize(description)   -- minúsculas, trim, sem acento
  last = most recent Transaction of userId where normalize(description) = normalized
  return last?.category_id ?? null
```

## Resolução por linha (RF-06)

```
for each extracted row:
  dup = detectDuplicate(row, destination)
  if dup == 'exact':
    skip (não cria ImportedRow)
    continue
  category = suggestCategory(userId, row.description)
  importedRow = create ImportedRow {
    ...row, suggested_category_id: category,
    is_duplicate_suspect: dup == 'suspect',
    duplicate_of_transaction_id: dup == 'suspect' ? matched.id : null,
    resolution: 'pendente'
  }
  if batch.mode == 'direct' and dup == 'none':
    transaction = create Transaction { account_id/card_id: destination, type: inferido do sinal,
                                        amount: row.amount, date: row.date,
                                        description: row.description, category_id: category,
                                        external_id: row.external_id, import_batch_id: batch.id }
    importedRow.resolution = 'aceita'
    importedRow.created_transaction_id = transaction.id
  -- caso contrário (staged, ou direct com suspeita): fica 'pendente' pra revisão
```

## Revisão e confirmação (RF-06)

```
GET    /import-batches                          lista lotes do usuário (histórico — RF-08)
GET    /import-batches/:id                      detalhe do lote
GET    /import-batches/:id/rows                 lista de ImportedRow do lote (todas, com resolution)

PATCH  /imported-rows/:id
  body: { date?, description?, amount?, category_id? }
  -> só permitido se resolution = 'pendente'

POST   /imported-rows/:id/discard
  -> resolution = 'descartada'; só permitido se resolution = 'pendente'

POST   /import-batches/:id/confirm
  -> para cada ImportedRow do lote com resolution = 'pendente': cria Transaction com os valores
     atuais da linha (editados ou não), marca resolution = 'aceita' e created_transaction_id
  -> marca ImportBatch.status = 'concluido'
  -> bloqueado se ImportBatch.status != 'aguardando_revisao'
```

Autenticação: todo endpoint exige `requireAuth` (Etapa 1); toda query de `ImportBatch`/
`ImportedRow` passa pelo helper `scopedToUser`. O endpoint interno de processamento não usa
`requireAuth` (não é chamado pelo usuário) — usa a validação própria do Cloud Tasks.

## Validações
- Upload: `format` obrigatório; tamanho máximo do arquivo 10 MB; extensão/mimetype deve bater
  com `format` escolhido (ex.: `.ofx` para `ofx`, `.csv` para `csv`, `.pdf` para `pdf_invoice`)
- Destino: exatamente um entre `account_id`/`card_id`, compatível com `format` (ver CHECK acima);
  deve pertencer ao usuário autenticado e estar `is_active = true`
- `PATCH /imported-rows/:id` e `POST /imported-rows/:id/discard`: bloqueado se
  `resolution != 'pendente'`
- `POST /import-batches/:id/confirm`: bloqueado se `ImportBatch.status != 'aguardando_revisao'`

## Decisões técnicas
- Fila via Cloud Tasks (não Cloud Scheduler/cron) — cada upload gera exatamente um job pontual,
  diferente de uma rotina recorrente; alinhado com a decisão de não introduzir "CPU sempre
  alocada" nem GCS só para essa etapa
- `raw_content` como `BYTEA` em Postgres (não um bucket) — arquivos de extrato/fatura pessoais
  são pequenos (KBs a poucos MBs), e o conteúdo é efêmero (janela de processamento), então não
  compensa uma peça de infra de storage de objetos só para isso
- Sem coluna de status persistida em `ImportedRow` além de `resolution` — diferente de
  `Invoice`/`Payable` (Fases 4/5), aqui não há transições automáticas por data, só transições
  por ação do usuário ou do processamento, então uma coluna de estado direta é suficiente (não
  precisa de cálculo derivado)
- Falha do lote inteiro (RF-07) é deliberadamente mais simples que processamento parcial —
  menos estado a gerenciar (nunca existe um lote "parcialmente processado" por erro, só por
  revisão pendente), ao custo de o usuário eventualmente precisar corrigir o arquivo fora do
  sistema para uma única linha ruim

## Frontend (React + Vite + TypeScript)
Reaproveita client HTTP e guarda de rota da Etapa 1; estende as telas de conta/cartão da Etapa 2 e
o extrato da Etapa 3.
- Tela de upload: seleção de arquivo, formato, destino (conta ou cartão, filtrado conforme o
  formato escolhido) e modo; ao enviar, redireciona para uma tela de acompanhamento que faz
  polling de `GET /import-batches/:id` até sair de `processando`
- Tela de revisão: tabela de `ImportedRow` pendentes, com campos editáveis inline (categoria via
  seletor pré-preenchido com a sugestão), badge de "possível duplicata" com o lançamento
  correspondente (`duplicate_of_transaction_id`) e botão de descartar por linha; resumo no topo
  mostrando quantas linhas já foram aceitas automaticamente (modo `direct`); botão "confirmar
  importação" chama `POST /import-batches/:id/confirm`
- Tela de histórico: lista de `ImportBatch` com status, data, formato e destino; lote
  `aguardando_revisao` linka direto pra tela de revisão
- Mensagem de falha (`status='falhou'`) exibindo `error_message` e sugestão de tentar outro
  formato/exportação
