import { describe, expect, it, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { createAuthenticatedUser } from '../../test/authHelper.js'
import { prismaTest } from '../../test/db.js'

const app = createApp()

let bankId: string

beforeAll(async () => {
  const bank = await prismaTest.bank.findUniqueOrThrow({ where: { code: '001' } })
  bankId = bank.id
})

async function createAccount(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Conta ${Date.now()}-${Math.random()}`, bankId, initialBalance: 0, ...overrides })
  return res.body.id as string
}

async function createCard(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Cartão ${Date.now()}-${Math.random()}`, creditLimit: 5000, closingDay: 10, dueDay: 20, ...overrides })
  return res.body.id as string
}

function ofxFile(transactions: string): Buffer {
  return Buffer.from(
    `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>${transactions}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
    'utf-8'
  )
}

function ofxTxn(fitId: string, date: string, amount: string, memo: string): string {
  return `<STMTTRN><DTPOSTED>${date}\n<TRNAMT>${amount}\n<FITID>${fitId}\n<MEMO>${memo}\n</STMTTRN>`
}

function csvFile(rows: Array<[string, string, string, string]>): Buffer {
  return Buffer.from(rows.map((r) => r.join(',')).join('\n'), 'utf-8')
}

async function uploadOfx(
  token: string,
  buffer: Buffer,
  fields: { accountId?: string; cardId?: string; mode: string; confirmDuplicateFile?: boolean }
) {
  let req = request(app)
    .post('/import-batches')
    .set('Authorization', `Bearer ${token}`)
    .field('format', 'ofx')
    .field('mode', fields.mode)
    .attach('file', buffer, 'extrato.ofx')
  if (fields.accountId) req = req.field('accountId', fields.accountId)
  if (fields.cardId) req = req.field('cardId', fields.cardId)
  if (fields.confirmDuplicateFile !== undefined) {
    req = req.field('confirmDuplicateFile', String(fields.confirmDuplicateFile))
  }
  return req
}

async function uploadCsv(
  token: string,
  buffer: Buffer,
  fields: { accountId?: string; cardId?: string; mode: string; format?: string }
) {
  let req = request(app)
    .post('/import-batches')
    .set('Authorization', `Bearer ${token}`)
    .field('format', fields.format ?? 'csv')
    .field('mode', fields.mode)
    .attach('file', buffer, (fields.format ?? 'csv') === 'pdf_invoice' ? 'fatura.pdf' : 'extrato.csv')
  if (fields.accountId) req = req.field('accountId', fields.accountId)
  if (fields.cardId) req = req.field('cardId', fields.cardId)
  return req
}

async function waitForBatch(token: string, id: string, timeoutMs = 5000) {
  const start = Date.now()
  for (;;) {
    const res = await request(app).get(`/import-batches/${id}`).set('Authorization', `Bearer ${token}`)
    if (res.body.status !== 'processando') return res.body
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for import batch to finish processing')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe('POST /import-batches — OFX (RF-01, RF-02, RF-03)', () => {
  it('processes an OFX file in direct mode and creates transactions automatically', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const upload = await uploadOfx(
      token,
      ofxFile(ofxTxn('fit-1', '20240115', '-50.00', 'Mercado')),
      { accountId, mode: 'direct' }
    )
    expect(upload.status).toBe(202)
    expect(upload.body.status).toBe('processando')

    const batch = await waitForBatch(token, upload.body.id)
    expect(batch.status).toBe('concluido')

    const txns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items).toMatchObject([
      { type: 'expense', amount: '50', description: 'Mercado', externalId: 'fit-1' },
    ])

    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body).toHaveLength(1)
    expect(rows.body[0].resolution).toBe('aceita')
  })

  it('leaves everything pending for review in staged mode, even without duplicate suspicion', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const upload = await uploadOfx(token, ofxFile(ofxTxn('fit-2', '20240201', '1000.00', 'Salário')), {
      accountId,
      mode: 'staged',
    })
    const batch = await waitForBatch(token, upload.body.id)
    expect(batch.status).toBe('aguardando_revisao')

    const txns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items).toHaveLength(0)

    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body[0].resolution).toBe('pendente')
  })

  it('confirms a staged batch, creating a Transaction for each pending row', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const upload = await uploadOfx(token, ofxFile(ofxTxn('fit-3', '20240301', '-30.00', 'Farmácia')), {
      accountId,
      mode: 'staged',
    })
    await waitForBatch(token, upload.body.id)

    const confirmRes = await request(app)
      .post(`/import-batches/${upload.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.status).toBe('concluido')

    const txns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items).toMatchObject([{ description: 'Farmácia', amount: '30' }])
  })

  it('rejects confirming a batch that is not awaiting review', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const upload = await uploadOfx(token, ofxFile(ofxTxn('fit-4', '20240101', '-10.00', 'X')), {
      accountId,
      mode: 'direct',
    })
    await waitForBatch(token, upload.body.id)

    const confirmRes = await request(app)
      .post(`/import-batches/${upload.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
    expect(confirmRes.status).toBe(409)
  })
})

describe('Detecção de duplicata (RF-04)', () => {
  it('silently drops an exact duplicate (same FITID) without creating an ImportedRow', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const first = await uploadOfx(token, ofxFile(ofxTxn('dup-1', '20240110', '-20.00', 'Padaria')), {
      accountId,
      mode: 'direct',
    })
    await waitForBatch(token, first.body.id)

    const second = await uploadOfx(
      token,
      ofxFile(ofxTxn('dup-1', '20240110', '-20.00', 'Padaria') + ofxTxn('dup-2', '20240111', '-5.00', 'Café')),
      { accountId, mode: 'direct', confirmDuplicateFile: true }
    )
    const batch = await waitForBatch(token, second.body.id)
    expect(batch.status).toBe('concluido')

    const rows = await request(app)
      .get(`/import-batches/${second.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body).toHaveLength(1)
    expect(rows.body[0].externalId).toBe('dup-2')

    const txns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items).toHaveLength(2)
  })

  it('marks a suspect duplicate (same date/amount/type, no external_id) pending even in direct mode', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 40, date: '2024-04-05', description: 'Restaurante', accountId })

    const upload = await uploadCsv(token, csvFile([['2024-04-05', 'Restaurante (import)', '40', 'expense']]), {
      accountId,
      mode: 'direct',
    })
    const batch = await waitForBatch(token, upload.body.id)
    expect(batch.status).toBe('aguardando_revisao')

    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body[0]).toMatchObject({ isDuplicateSuspect: true, resolution: 'pendente' })
    expect(rows.body[0].duplicateOfTransactionId).toBeTruthy()
  })
})

describe('Sugestão de categoria (RF-05)', () => {
  it('suggests the category last used for an exact normalized description match', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const categories = await request(app).get('/categories').set('Authorization', `Bearer ${token}`)
    const expenseCategory = categories.body.find((c: { type: string }) => c.type === 'expense')

    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 15,
        date: '2024-01-01',
        description: 'Mercado Extra',
        accountId,
        categoryId: expenseCategory.id,
      })

    const upload = await uploadCsv(token, csvFile([['2024-05-01', 'mercado   extra', '25', 'expense']]), {
      accountId,
      mode: 'staged',
    })
    await waitForBatch(token, upload.body.id)

    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body[0].suggestedCategoryId).toBe(expenseCategory.id)
  })
})

describe('Falha de processamento (RF-07)', () => {
  it('fails the whole batch when the file cannot be extracted, creating no rows/transactions', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const upload = await uploadOfx(token, Buffer.from('not an ofx file', 'utf-8'), { accountId, mode: 'direct' })
    const batch = await waitForBatch(token, upload.body.id)

    expect(batch.status).toBe('falhou')
    expect(batch.errorMessage).toBeTruthy()
    expect(batch.rawContent).toBeFalsy()

    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    expect(rows.body).toHaveLength(0)
  })
})

describe('PDF de fatura entra no fluxo de invoice_id (RF-03, requirements.md contexto)', () => {
  it('assigns the imported card transaction to an invoice', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    const upload = await uploadCsv(
      token,
      csvFile([['2024-06-10', 'Compra na fatura', '99', 'expense']]),
      { cardId, mode: 'direct', format: 'pdf_invoice' }
    )
    await waitForBatch(token, upload.body.id)

    const txns = await request(app)
      .get(`/transactions?cardId=${cardId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items[0].invoiceId).toBeTruthy()
  })
})

describe('Aviso de arquivo já importado (RF-01)', () => {
  it('requires confirmDuplicateFile to re-import an identical, already-completed file', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const content = ofxFile(ofxTxn('same-1', '20240101', '-1.00', 'X'))

    const first = await uploadOfx(token, content, { accountId, mode: 'direct' })
    await waitForBatch(token, first.body.id)

    const secondNoConfirm = await request(app)
      .post('/import-batches')
      .set('Authorization', `Bearer ${token}`)
      .field('format', 'ofx')
      .field('mode', 'direct')
      .field('accountId', accountId)
      .attach('file', content, 'extrato.ofx')
    expect(secondNoConfirm.status).toBe(409)
    expect(secondNoConfirm.body.previousImportBatchId).toBe(first.body.id)

    const secondConfirmed = await uploadOfx(token, content, { accountId, mode: 'direct', confirmDuplicateFile: true })
    expect(secondConfirmed.status).toBe(202)
  })
})

describe('Validações de upload', () => {
  it('rejects an upload without a file', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const res = await request(app)
      .post('/import-batches')
      .set('Authorization', `Bearer ${token}`)
      .field('format', 'ofx')
      .field('mode', 'direct')
      .field('accountId', accountId)
    expect(res.status).toBe(400)
  })

  it('rejects pdf_invoice with an accountId destination', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const res = await uploadCsv(token, csvFile([['2024-01-01', 'X', '1', 'expense']]), {
      accountId,
      mode: 'direct',
      format: 'pdf_invoice',
    })
    expect(res.status).toBe(400)
  })

  it('rejects a file whose extension does not match the chosen format', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const res = await request(app)
      .post('/import-batches')
      .set('Authorization', `Bearer ${token}`)
      .field('format', 'ofx')
      .field('mode', 'direct')
      .field('accountId', accountId)
      .attach('file', Buffer.from('x'), 'extrato.csv')
    expect(res.status).toBe(400)
  })

  it('rejects a file over the 10 MB limit', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'a')
    const res = await request(app)
      .post('/import-batches')
      .set('Authorization', `Bearer ${token}`)
      .field('format', 'ofx')
      .field('mode', 'direct')
      .field('accountId', accountId)
      .attach('file', bigBuffer, 'extrato.ofx')
    expect(res.status).toBe(400)
  })
})

describe('Edição e descarte de linha pendente (RF-06)', () => {
  it('edits a pending row, including correcting its type', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const upload = await uploadOfx(token, ofxFile(ofxTxn('edit-1', '20240101', '-10.00', 'X')), {
      accountId,
      mode: 'staged',
    })
    const batch = await waitForBatch(token, upload.body.id)
    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    const rowId = rows.body[0].id

    const patch = await request(app)
      .patch(`/imported-rows/${rowId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'income', amount: 15, description: 'Corrigido' })
    expect(patch.status).toBe(200)
    expect(patch.body).toMatchObject({ type: 'income', amount: '15', description: 'Corrigido' })
    expect(batch.status).toBe('aguardando_revisao')
  })

  it('discards a pending row individually', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const upload = await uploadOfx(
      token,
      ofxFile(ofxTxn('disc-1', '20240101', '-10.00', 'A') + ofxTxn('disc-2', '20240102', '-20.00', 'B')),
      { accountId, mode: 'staged' }
    )
    await waitForBatch(token, upload.body.id)
    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    const toDiscard = rows.body.find((r: { externalId: string }) => r.externalId === 'disc-1')

    const discardRes = await request(app)
      .post(`/imported-rows/${toDiscard.id}/discard`)
      .set('Authorization', `Bearer ${token}`)
    expect(discardRes.body.resolution).toBe('descartada')

    await request(app)
      .post(`/import-batches/${upload.body.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)

    const txns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items).toHaveLength(1)
    expect(txns.body.items[0].description).toBe('B')
  })

  it('blocks editing/discarding a row that is no longer pending', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const upload = await uploadOfx(token, ofxFile(ofxTxn('final-1', '20240101', '-10.00', 'X')), {
      accountId,
      mode: 'direct',
    })
    await waitForBatch(token, upload.body.id)
    const rows = await request(app)
      .get(`/import-batches/${upload.body.id}/rows`)
      .set('Authorization', `Bearer ${token}`)
    const rowId = rows.body[0].id

    const patch = await request(app)
      .patch(`/imported-rows/${rowId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5 })
    expect(patch.status).toBe(409)

    const discardRes = await request(app)
      .post(`/imported-rows/${rowId}/discard`)
      .set('Authorization', `Bearer ${token}`)
    expect(discardRes.status).toBe(409)
  })
})

describe('GET /import-batches (RF-08)', () => {
  it('lists only the authenticated user’s own batches', async () => {
    const { token } = await createAuthenticatedUser(app)
    const other = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const otherAccountId = await createAccount(other.token)

    await uploadOfx(token, ofxFile(ofxTxn('list-1', '20240101', '-10.00', 'X')), { accountId, mode: 'direct' })
    await uploadOfx(other.token, ofxFile(ofxTxn('list-2', '20240101', '-10.00', 'Y')), {
      accountId: otherAccountId,
      mode: 'direct',
    })

    const list = await request(app).get('/import-batches').set('Authorization', `Bearer ${token}`)
    expect(list.body).toHaveLength(1)
  })
})

describe('POST /internal/import-batches/:id/process', () => {
  it('rejects a call without the internal secret', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const upload = await uploadOfx(token, ofxFile(ofxTxn('int-1', '20240101', '-10.00', 'X')), {
      accountId,
      mode: 'direct',
    })
    await waitForBatch(token, upload.body.id)

    const res = await request(app).post(`/internal/import-batches/${upload.body.id}/process`)
    expect(res.status).toBe(401)
  })
})

describe('Erros não cobertos acima', () => {
  it('returns 404 for a batch that does not exist', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .get('/import-batches/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 404 for an imported row that does not exist', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .patch('/imported-rows/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10 })
    expect(res.status).toBe(404)
  })

  it('rejects an upload targeting an inactive account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    await request(app)
      .patch(`/accounts/${accountId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })

    const res = await uploadOfx(token, ofxFile(ofxTxn('inactive-1', '20240101', '-1.00', 'X')), {
      accountId,
      mode: 'direct',
    })
    expect(res.status).toBe(409)
  })
})
