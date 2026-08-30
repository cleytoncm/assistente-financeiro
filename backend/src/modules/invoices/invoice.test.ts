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

async function createCard(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/cards')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Cartão ${Date.now()}-${Math.random()}`,
      creditLimit: 5000,
      closingDay: 10,
      dueDay: 20,
      ...overrides,
    })
  return res.body.id as string
}

async function createAccount(token: string) {
  const res = await request(app)
    .post('/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Conta ${Date.now()}-${Math.random()}`, bankId, initialBalance: 0 })
  return res.body.id as string
}

describe('Fatura criada sob demanda (RF-01)', () => {
  it('creates an invoice the first time a card transaction is registered', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'Compra', cardId })

    expect(txn.body.invoiceId).toBeTruthy()

    const invoices = await request(app)
      .get(`/cards/${cardId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
    expect(invoices.body).toHaveLength(1)
    expect(invoices.body[0].id).toBe(txn.body.invoiceId)
  })

  it('creates intermediate empty invoices for an installment purchase several months ahead', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 300,
        date: '2024-01-05',
        description: 'Parcelado',
        cardId,
        installments: 3,
      })

    const invoices = await request(app)
      .get(`/cards/${cardId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
    expect(invoices.body.length).toBeGreaterThanOrEqual(3)
  })

  it('assigns a transaction dated exactly on the closing date to the current invoice', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    const first = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-01', description: 'X', cardId })
    const invoice = await request(app)
      .get(`/invoices/${first.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)

    const onClosing = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 10,
        date: invoice.body.closingDate.slice(0, 10),
        description: 'Y',
        cardId,
      })

    expect(onClosing.body.invoiceId).toBe(first.body.invoiceId)
  })
})

describe('GET /cards/:id/invoices e GET /invoices/:id (RF-08)', () => {
  it('lists invoices with computed status and total', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .get(`/cards/${cardId}/invoices`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body[0].total).toBe('100')
    expect(['aberta', 'fechada', 'atrasada']).toContain(res.body[0].status)
  })

  it('returns invoice detail and its transactions', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const detail = await request(app)
      .get(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.total).toBe('100')

    const list = await request(app)
      .get(`/invoices/${txn.body.invoiceId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.body.items).toHaveLength(1)
    expect(list.body.items[0].id).toBe(txn.body.id)
  })

  it('returns 404 for an invoice belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const cardId = await createCard(userA.token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .get(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${userB.token}`)
    expect(res.status).toBe(404)
  })
})

describe('PATCH /invoices/:id (RF-02)', () => {
  it('updates closing/due dates', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .patch(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDate: '2024-03-08', dueDate: '2024-03-18' })

    expect(res.status).toBe(200)
    expect(res.body.closingDate.slice(0, 10)).toBe('2024-03-08')
  })

  it('rejects closingDate on/after dueDate', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .patch(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDate: '2024-03-25', dueDate: '2024-03-20' })

    expect(res.status).toBe(409)
  })

  it('is blocked once the invoice is paid', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const res = await request(app)
      .patch(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDate: '2024-03-08' })

    expect(res.status).toBe(409)
  })
})

describe('POST /invoices/:id/pay (RF-04, RF-05)', () => {
  it('pays the invoice, creating an expense transaction on the account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 100, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('paga')

    const accountTxns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(accountTxns.body.items).toHaveLength(1)
    expect(accountTxns.body.items[0].amount).toBe('100')
  })

  it('allows paying an invoice that is still aberta (pagamento antecipado)', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })

    // Force the invoice into 'aberta' deterministically (both dates safely in the future),
    // regardless of the real wall-clock date the test happens to run on.
    await request(app)
      .patch(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDate: '2999-01-01', dueDate: '2999-01-10' })
    const before = await request(app)
      .get(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(before.body.status).toBe('aberta')

    const res = await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('paga')
  })

  it('rejects paying an already-paid invoice', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const res = await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    expect(res.status).toBe(409)
  })

  it('rejects a payment account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const cardId = await createCard(userA.token)
    const otherAccountId = await createAccount(userB.token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })

    const res = await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ accountId: otherAccountId })

    expect(res.status).toBe(400)
  })
})

describe('Trava de edição em fatura fechada (RF-07)', () => {
  it('blocks editing a transaction whose invoice is already paid', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const res = await request(app)
      .patch(`/transactions/${txn.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Alterado' })

    expect(res.status).toBe(409)
  })

  it('blocks removing a transaction whose invoice is already paid', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const res = await request(app)
      .delete(`/transactions/${txn.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
  })

  it('allows creating a new transaction in a paid invoice (RF-06 territory, not RF-07)', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 10,
        date: '2024-03-06',
        description: 'Esquecido',
        cardId,
        confirmPaymentAdjustment: true,
      })

    expect(res.status).toBe(201)
  })
})

describe('Lançamento retroativo (RF-06)', () => {
  it('allows a retroactive transaction in a fechada invoice without confirmation, recalculating the total', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })

    // Force the invoice into 'atrasada' deterministically, regardless of the real wall-clock
    // date — closingDate/dueDate both safely in the past, with the retroactive date below still
    // resolving to this same invoice (closingDate >= retroactive date).
    await request(app)
      .patch(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDate: '2020-06-01', dueDate: '2020-06-10' })
    const invoiceBefore = await request(app)
      .get(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(invoiceBefore.body.status).toBe('atrasada')

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 20, date: '2020-05-01', description: 'Esquecido', cardId })

    expect(res.status).toBe(201)
    const invoiceAfter = await request(app)
      .get(`/invoices/${txn.body.invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(invoiceAfter.body.total).toBe('70')
  })

  it('requires confirmPaymentAdjustment for a retroactive transaction in a paid invoice, then updates the payment amount', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const accountId = await createAccount(token)
    const txn = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-05', description: 'X', cardId })
    await request(app)
      .post(`/invoices/${txn.body.invoiceId}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId })

    const withoutConfirm = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 30, date: '2024-03-06', description: 'Esquecido', cardId })
    expect(withoutConfirm.status).toBe(409)
    expect(withoutConfirm.body.invoicePaymentAdjustment).toMatchObject({
      invoiceId: txn.body.invoiceId,
      oldAmount: '50',
      newAmount: '80',
    })

    const withConfirm = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 30,
        date: '2024-03-06',
        description: 'Esquecido',
        cardId,
        confirmPaymentAdjustment: true,
      })
    expect(withConfirm.status).toBe(201)

    const paymentTxns = await request(app)
      .get(`/transactions?accountId=${accountId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(paymentTxns.body.items[0].amount).toBe('80')
  })
})
