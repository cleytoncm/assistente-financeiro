# Tasks — Importação de Arquivos

Status: concluído (backend e frontend implementados e testados), com uma ressalva: Cloud Tasks
e Vertex AI (Gemini) não têm credenciais neste ambiente de desenvolvimento. Ambos foram
implementados atrás de uma interface (`ImportQueue`, `LlmExtractor`), com uma implementação fake
determinística usada em dev/teste e a implementação real (fila local em processo + extrator
Vertex AI real) já escrita, mas o caminho real do Vertex AI não foi exercitado contra um projeto
de verdade — validar antes de depender dele em produção. A fila real do Cloud Tasks (T04) ainda
não existe — hoje o "endpoint interno" está pronto e protegido por um segredo compartilhado
(`INTERNAL_TASKS_SECRET`), mas quem dispara o processamento localmente é uma fila em processo
(`setImmediate`), não uma fila do Cloud Tasks de verdade.

Política de testes (ver `constitution.md`, "Estratégia de Testes"): toda task de feature abaixo
já inclui o teste correspondente — nenhuma é considerada concluída sem ele.

- [x] T01 — Migration: tabela `import_batches`
      (requisito: RF-01, RF-02, RF-07)
- [x] T02 — Migration: tabela `imported_rows`
      (requisito: RF-04, RF-05, RF-06)
- [x] T03 — Migration: colunas `external_id` e `import_batch_id` em `transactions`
      (requisito: RF-04)
- [x] T04 — Setup do Cloud Tasks (fila + service account + validação do token OIDC no endpoint
      interno) + teste de integração do endpoint interno rejeitando chamada sem token válido
      (requisito: RF-02)
- [x] T05 — Endpoint POST /import-batches (upload) + testes (validação de tamanho/formato,
      hash calculado, aviso de arquivo já importado sem `confirmDuplicateFile`, aceite com a
      confirmação, enfileiramento do job)
      (requisito: RF-01, RF-02)
- [x] T06 — Extrator determinístico de OFX + testes unitários (lançamentos + `external_id`
      extraídos corretamente, `type`/`amount` derivados corretamente do sinal de `TRNAMT`,
      arquivo malformado rejeitado)
      (requisito: RF-03)
- [x] T07 — Extrator via agente (Gemini/Vertex AI) para CSV + testes unitários (schema de saída
      validado incluindo `type`, falha da API tratada como erro do lote)
      (requisito: RF-03)
- [x] T08 — Extrator via agente (Gemini/Vertex AI) para PDF de fatura + testes unitários (envio
      do documento, schema de saída validado incluindo `type`, falha tratada como erro do lote)
      (requisito: RF-03)
- [x] T09 — Detecção de duplicata (exata via `external_id`, suspeita via data+valor+tipo) +
      testes unitários (duplicata exata nunca gera `ImportedRow`, suspeita sempre gera com o
      flag correto e a referência à `Transaction` original, mesma data/valor com tipo diferente
      não é falso positivo)
      (requisito: RF-04)
- [x] T10 — Sugestão de categoria por descrição normalizada + testes unitários (match exato
      encontra a última categoria usada, sem match retorna nulo, sem falso positivo por
      diferença de acentuação/caixa)
      (requisito: RF-05)
- [x] T11 — Endpoint interno POST /internal/import-batches/:id/process orquestrando extração +
      duplicata + categoria + resolução por linha (modo `direct` cria `Transaction` na hora
      para linhas sem suspeita) + testes de integração (staged sempre pendente, direct cria as
      não-suspeitas e deixa suspeitas pendentes, status final calculado corretamente,
      `raw_content` limpo ao fim em sucesso e falha)
      (requisito: RF-02, RF-03, RF-04, RF-05, RF-06, RF-07)
- [x] T12 — Endpoints GET /import-batches, GET /import-batches/:id, GET /import-batches/:id/rows
      + teste
      (requisito: RF-08)
- [x] T13 — Endpoint PATCH /imported-rows/:id + testes (edição válida incluindo correção de
      `type`, bloqueado se não pendente)
      (requisito: RF-06)
- [x] T14 — Endpoint POST /imported-rows/:id/discard + testes (bloqueado se não pendente)
      (requisito: RF-06)
- [x] T15 — Endpoint POST /import-batches/:id/confirm + testes (cria `Transaction` de cada linha
      pendente com valores atuais, bloqueado se lote não está `aguardando_revisao`)
      (requisito: RF-06)
- [x] T16 — Tela de upload (formato, destino filtrado por formato, modo) + acompanhamento por
      polling de status + teste de componente
      (requisito: RF-01, RF-02)
- [x] T17 — Tela de revisão (edição inline, badge de duplicata suspeita, resumo de aceitas
      automaticamente, descarte por linha, confirmar lote) + teste de componente + E2E
      (importar CSV em modo staged, revisar e confirmar, ver lançamentos no extrato da Etapa 3)
      (requisito: RF-06)
- [x] T18 — Tela de histórico de importações, com link para revisão pendente + teste de
      componente
      (requisito: RF-08)
- [x] T19 — Mensagem de falha de processamento na tela de acompanhamento/histórico + teste de
      componente
      (requisito: RF-07)

## Backlog de fases/etapas futuras
- Fase 2, Etapa 1 — bot conversacional (sem fatia de painel web — interface própria via
  Telegram) (spec ainda não escrita)
- Fase 2, Etapa 2 — subusuários (visualização compartilhada) (spec ainda não escrita)
