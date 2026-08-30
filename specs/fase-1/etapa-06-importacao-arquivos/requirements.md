# Requisitos — Importação de Arquivos

## Contexto
Depende da Etapa 1 (Autenticação), Etapa 2 (`Account`, `Card`, `Bank`) e Etapa 3 (`Transaction`,
`Category`). Fatura de cartão (Etapa 4) é usada indiretamente: um lançamento importado de PDF de
fatura com `card_id` entra no mesmo fluxo de resolução de `invoice_id` já existente, sem lógica
própria de fatura nesta etapa. Não tem relação com a Etapa 5 (`Payable`) — importação de arquivo
representa fatos já ocorridos (extrato passado), nunca uma obrigação futura agendada.

Substitui a integração bancária automática (Open Finance/Pluggy), descartada desde a
constituição do projeto (`specs/00-overview/constitution.md`, "Não-objetivos").

## Requisitos funcionais

### RF-01 — Upload de arquivo para importação
Como usuário, quero enviar um arquivo (OFX, CSV ou PDF de fatura) escolhendo previamente o
formato, a conta/cartão de destino e o modo de importação.
- Critérios de aceite:
  - Campos obrigatórios no upload: `format` (`ofx`/`csv`/`pdf_invoice`), destino (`account_id`
    **ou** `card_id` — nunca os dois), `mode` (`staged`/`direct`)
  - `pdf_invoice` só aceita `card_id` como destino; `ofx`/`csv` só aceitam `account_id`
  - O sistema calcula um hash do arquivo; se um arquivo idêntico já foi importado com sucesso
    antes pelo mesmo usuário, avisa a data desse import anterior e exige confirmação explícita
    para prosseguir mesmo assim
  - Resposta do upload é imediata (não espera o processamento terminar — RF-02), retornando o
    identificador do lote de importação com status inicial

### RF-02 — Processamento assíncrono com status consultável
Como usuário, quero poder acompanhar o andamento do processamento de um arquivo grande sem a
tela travar esperando, já que a extração (principalmente via agente, RF-03) pode demorar.
- Critérios de aceite:
  - O processamento roda em segundo plano (fila), fora da requisição de upload
  - O lote de importação tem um status consultável a qualquer momento:
    `processando` → `aguardando_revisao` **ou** `concluido` **ou** `falhou`
  - O conteúdo do arquivo é mantido apenas durante a janela de processamento; ao final (sucesso
    ou falha), o conteúdo é descartado — o sistema não guarda o arquivo original
    permanentemente, só os metadados do lote (formato, destino, hash, contagens, erro se houver)

### RF-03 — Extração de lançamentos do arquivo
Como sistema, preciso extrair de cada arquivo uma lista de lançamentos candidatos (data,
descrição, valor).
- Critérios de aceite:
  - **OFX**: extração determinística (formato já estruturado), preservando o identificador único
    de cada lançamento do banco (`FITID`) — usado na detecção de duplicata exata (RF-04)
  - **CSV**: extração via agente (LLM), sem exigir que o usuário mapeie colunas manualmente —
    cobre a variação de formato entre bancos sem parser dedicado por layout
  - **PDF de fatura**: extração via agente (LLM) com suporte a documento (PDF enviado
    diretamente ao modelo), sem parser dedicado por banco/emissor

### RF-04 — Detecção de duplicata
Como usuário, não quero que reimportar um arquivo (ou um período que já tenho lançado) crie
lançamentos repetidos.
- Critérios de aceite:
  - **Duplicata exata**: um lançamento extraído cujo `external_id` (FITID) já existe numa
    `Transaction` da mesma conta/cartão de destino é automaticamente descartado, sem nunca
    aparecer na revisão (RF-06), em nenhum dos dois modos
  - **Duplicata suspeita**: um lançamento sem `external_id` (CSV, PDF) cuja combinação de conta/
    cartão de destino + data + valor já existe numa `Transaction` (manual ou de outro import) é
    marcado como suspeito e **sempre** entra em revisão (RF-06), mesmo no modo `direct`
  - Lançamento sem nenhuma suspeita de duplicata segue o comportamento normal do modo escolhido
    (RF-06)

### RF-05 — Sugestão automática de categoria
Como usuário, quero que lançamentos importados já venham com uma categoria sugerida quando o
sistema já viu uma descrição igual antes.
- Critérios de aceite:
  - Um lançamento extraído cuja descrição (normalizada: minúsculas, sem espaços extras, sem
    acento) bate exatamente com a de uma `Transaction` já existente do usuário recebe a mesma
    `category_id` que foi usada da última vez, como sugestão
  - Sem correspondência exata, o lançamento fica sem categoria sugerida (`category_id` nulo) —
    sem tentativa de correspondência aproximada/parcial nesta etapa

### RF-06 — Revisão e confirmação
Como usuário, quero revisar, editar e confirmar os lançamentos extraídos antes que virem
lançamentos reais, no modo `staged` sempre, e no modo `direct` só para os suspeitos de
duplicata.
- Critérios de aceite:
  - Todo lançamento extraído (não descartado por duplicata exata) gera um registro de linha
    importada, independente do modo, mantendo histórico auditável do lote inteiro
  - No modo `staged`: toda linha começa pendente de revisão
  - No modo `direct`: linha sem suspeita de duplicata já é aceita e vira `Transaction`
    automaticamente; linha suspeita fica pendente de revisão (RF-04)
  - Uma linha pendente pode ser editada (data, descrição, valor, categoria) antes de ser aceita
  - Uma linha pendente pode ser descartada individualmente (usuário decide que não deve virar
    lançamento)
  - Confirmar o lote cria uma `Transaction` (Etapa 3) para cada linha pendente ainda não
    descartada, usando os valores (editados ou não) daquela linha

### RF-07 — Falha de processamento
Como usuário, quero saber claramente quando um arquivo não pôde ser processado, em vez de ver
uma importação parcial e inconsistente.
- Critérios de aceite:
  - Se qualquer linha do arquivo não puder ser extraída com confiança, o lote inteiro falha —
    nenhuma linha importada é criada
  - O status do lote vai para `falhou`, com uma mensagem indicando que não foi possível
    processar o arquivo e sugerindo tentar outro formato/exportação

### RF-08 — Histórico de importações
Como usuário, quero ver a lista dos meus lotes de importação (passados e em andamento) para
acompanhar status ou retomar uma revisão pendente.
- Critérios de aceite:
  - Lista mostra data, formato, conta/cartão de destino e status de cada lote
  - Um lote com status `aguardando_revisao` permite retomar a tela de revisão (RF-06)

## Fora de escopo desta feature
- Mapeamento manual de colunas de CSV — substituído pela extração via agente (RF-03)
- Sugestão de categoria por similaridade de texto (fuzzy matching) ou via agente — fica para
  evolução futura, com provedor de LLM a definir (Google ou OpenAI, citados como possibilidade
  pelo crédito disponível)
- Armazenamento permanente do arquivo original para auditoria — só o conteúdo necessário
  durante a janela de processamento é mantido, depois descartado (RF-02)
- Processamento parcial de arquivo com erro (aceitar o que der certo, reportar o resto) — todo
  erro de extração falha o lote inteiro (RF-07)
- Suporte a todo e qualquer banco/emissor em PDF de fatura sem verificação prévia — a extração
  via agente (RF-03) não é garantida para qualquer layout, mas não há lista fechada de bancos
  suportados nesta etapa (diferente de uma abordagem por parser dedicado, que exigiria essa
  lista)
- Importação de arquivo gerando conta a pagar/receber (Etapa 5) — import só cria `Transaction`
- Notificação de importação concluída fora da própria tela (e-mail, push) — reservado para
  quando existir canal proativo (bot, Fase 2, Etapa 1)

## Decisões confirmadas
- Toda linha extraída de um arquivo gera um registro de linha importada (`ImportedRow`),
  independente do modo escolhido — garante histórico auditável completo do que um lote de
  importação fez, mesmo quando a maioria das linhas é aceita automaticamente (modo `direct`)
- OFX usa parser determinístico (não agente) especificamente para preservar a exatidão do
  `FITID`, do qual depende a detecção de duplicata exata (RF-04) — CSV e PDF de fatura não têm
  identificador equivalente, então usam extração via agente sem essa preocupação
- Processamento assíncrono via fila (Cloud Tasks), não "disparar e esquecer" simples — Cloud Run
  throttla CPU do container após a resposta HTTP ser enviada, então processamento em segundo
  plano precisa de uma invocação própria (a fila dispara um endpoint interno de processamento)

## Frontend desta etapa (painel web)
Construído junto com o backend desta etapa. Todas as páginas exigem login (guarda de rota da
Etapa 1).
- Tela de upload: escolha de formato, destino (conta ou cartão) e modo (staged/direct)
- Indicador de progresso consultando o status do lote (RF-02) até sair de `processando`
- Tela de revisão (RF-06): lista de linhas pendentes, editáveis, com indicação visual de
  "possível duplicata"; resumo informativo das linhas já aceitas automaticamente (modo
  `direct`); botão de confirmar
- Tela de histórico de importações (RF-08), com acesso à revisão pendente de um lote
- Mensagem clara de falha (RF-07) com sugestão de tentar outro formato
