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

async function createStandalonePayable(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/payables')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'expense',
      amount: 300,
      dueDate: '2024-06-15',
      description: 'Conserto do carro',
      ...overrides,
    })
}

describe('POST /payables — avulsa (RF-01)', () => {
  it('creates a standalone payable with no group', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createStandalonePayable(token)

    expect(res.status).toBe(201)
    expect(res.body.groupId).toBeNull()
    expect(res.body.installmentNumber).toBeNull()
    expect(res.body.amount).toBe('300')
  })

  it('rejects an account belonging to another user', async () => {
    const { token } = await createAuthenticatedUser(app)
    const other = await createAuthenticatedUser(app)
    const otherAccount = await createAccount(other.token)

    const res = await createStandalonePayable(token, { accountId: otherAccount })
    expect(res.status).toBe(400)
  })

  it('rejects an inactive account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    await request(app)
      .patch(`/accounts/${accountId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })

    const res = await createStandalonePayable(token, { accountId })
    expect(res.status).toBe(400)
  })
})

describe('GET /payables — status derivado e filtros (RF-04, RF-11, RF-12)', () => {
  it('computes pendente/vence_hoje/atrasada/paga/cancelada across payables', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

    const pendentePayable = await createStandalonePayable(token, { dueDate: tomorrow })
    const hojePayable = await createStandalonePayable(token, { dueDate: today })
    const atrasadaPayable = await createStandalonePayable(token, { dueDate: yesterday })
    const pagaPayable = await createStandalonePayable(token, { dueDate: yesterday })
    const canceladaPayable = await createStandalonePayable(token, { dueDate: yesterday })

    await request(app)
      .post(`/payables/${pagaPayable.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    await request(app)
      .post(`/payables/${canceladaPayable.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const list = await request(app).get('/payables').set('Authorization', `Bearer ${token}`)
    const byId = Object.fromEntries(
      list.body.items.map((p: { id: string; status: string }) => [p.id, p.status])
    )

    expect(byId[pendentePayable.body.id]).toBe('pendente')
    expect(byId[hojePayable.body.id]).toBe('vence_hoje')
    expect(byId[atrasadaPayable.body.id]).toBe('atrasada')
    expect(byId[pagaPayable.body.id]).toBe('paga')
    expect(byId[canceladaPayable.body.id]).toBe('cancelada')
  })

  it('filters by status and by until (due_date <=)', async () => {
    const { token } = await createAuthenticatedUser(app)
    await createStandalonePayable(token, { dueDate: '2099-01-10' })
    await createStandalonePayable(token, { dueDate: '2099-03-10' })

    const untilFeb = await request(app)
      .get('/payables?until=2099-02-01')
      .set('Authorization', `Bearer ${token}`)
    expect(untilFeb.body.items).toHaveLength(1)
    expect(untilFeb.body.items[0].dueDate.slice(0, 10)).toBe('2099-01-10')

    const pendentes = await request(app)
      .get('/payables?status=pendente')
      .set('Authorization', `Bearer ${token}`)
    expect(pendentes.body.items).toHaveLength(2)
  })
})

describe('PATCH /payables/:id (RF-06)', () => {
  it('edits amount/dueDate/description on a single payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)

    const res = await request(app)
      .patch(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 350, description: 'Conserto + peça extra' })

    expect(res.status).toBe(200)
    expect(res.body.amount).toBe('350')
    expect(res.body.description).toBe('Conserto + peça extra')
  })

  it('blocks editing a paid payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token)
    await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    const res = await request(app)
      .patch(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 999 })
    expect(res.status).toBe(409)
  })

  it('blocks editing a cancelled payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)
    await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const res = await request(app)
      .patch(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 999 })
    expect(res.status).toBe(409)
  })
})

describe('POST /payables/:id/pay (RF-05)', () => {
  it('creates a Transaction of the payable type and links it back', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token, { type: 'expense', amount: 300 })

    const res = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    expect(res.status).toBe(200)
    expect(res.body.paidAmount).toBe('300')
    expect(res.body.paidTransactionId).toBeTruthy()

    const txns = await request(app)
      .get(`/transactions?accountId=${account}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txns.body.items[0]).toMatchObject({ type: 'expense', amount: '300', accountId: account })
  })

  it('accepts a paidAmount different from the predicted amount (discount/interest)', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token, { amount: 300 })

    const res = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account, paidAmount: 280 })

    expect(res.body.paidAmount).toBe('280')
    expect(res.body.amount).toBe('300')
  })

  it('rejects paying an already-paid payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token)
    await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    const res = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    expect(res.status).toBe(409)
  })

  it('rejects paying a cancelled payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token)
    await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const res = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    expect(res.status).toBe(409)
  })
})

describe('POST /payables/:id/cancel (RF-08)', () => {
  it('cancels a pending payable with an optional reason', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)

    const res = await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cancellationReason: 'Troquei de oficina' })

    expect(res.status).toBe(200)
    expect(res.body.cancellationReason).toBe('Troquei de oficina')
  })

  it('rejects cancelling an already-cancelled payable', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)
    await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})

    const res = await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(409)
  })

  it('requires confirmDeleteTransaction to cancel an already-paid payable, then removes its transaction', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token)
    const paid = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    const transactionId = paid.body.paidTransactionId as string

    const rejected = await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(rejected.status).toBe(409)
    expect(rejected.body.deleteTransaction.id).toBe(transactionId)

    const confirmed = await request(app)
      .post(`/payables/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmDeleteTransaction: true })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.paidTransactionId).toBeNull()

    const txn = await request(app)
      .get(`/transactions?accountId=${account}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txn.body.items).toHaveLength(0)
  })
})

describe('DELETE /payables/:id (RF-09)', () => {
  it('deletes a pending payable outright', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)

    const res = await request(app)
      .delete(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(204)

    const show = await request(app)
      .get(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(show.status).toBe(404)
  })

  it('requires confirmDeleteTransaction to delete an already-paid payable, cascading the transaction', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createStandalonePayable(token)
    const paid = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    const transactionId = paid.body.paidTransactionId as string

    const rejected = await request(app)
      .delete(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(rejected.status).toBe(409)
    expect(rejected.body.deleteTransaction.id).toBe(transactionId)

    const confirmed = await request(app)
      .delete(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmDeleteTransaction: true })
    expect(confirmed.status).toBe(204)

    const txn = await request(app)
      .get(`/transactions?accountId=${account}`)
      .set('Authorization', `Bearer ${token}`)
    expect(txn.body.items).toHaveLength(0)
  })
})

describe('GET /payables/summary (RF-11)', () => {
  it('aggregates totals payable/receivable due by the given date, ignoring paid/cancelled', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    await createStandalonePayable(token, { type: 'expense', amount: 100, dueDate: '2024-01-05' })
    await createStandalonePayable(token, { type: 'expense', amount: 50, dueDate: '2024-01-20' })
    const paidOne = await createStandalonePayable(token, {
      type: 'expense',
      amount: 999,
      dueDate: '2024-01-01',
    })
    await request(app)
      .post(`/payables/${paidOne.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })
    await createStandalonePayable(token, { type: 'income', amount: 200, dueDate: '2024-01-10' })

    const res = await request(app)
      .get('/payables/summary?until=2024-01-31')
      .set('Authorization', `Bearer ${token}`)

    expect(res.body).toEqual({ totalPayable: '150', totalReceivable: '200' })
  })
})

describe('GET /payables/:id', () => {
  it('returns the payable detail with computed status', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)

    const res = await request(app)
      .get(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBeTruthy()
  })

  it('returns 404 for a payable that does not exist', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .get('/payables/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /payables — paginação por cursor', () => {
  it('paginates with limit/cursor', async () => {
    const { token } = await createAuthenticatedUser(app)
    await createStandalonePayable(token, { dueDate: '2099-01-01' })
    await createStandalonePayable(token, { dueDate: '2099-02-01' })
    await createStandalonePayable(token, { dueDate: '2099-03-01' })

    const firstPage = await request(app)
      .get('/payables?limit=2')
      .set('Authorization', `Bearer ${token}`)
    expect(firstPage.body.items).toHaveLength(2)
    expect(firstPage.body.nextCursor).toBeTruthy()

    const secondPage = await request(app)
      .get(`/payables?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set('Authorization', `Bearer ${token}`)
    expect(secondPage.body.items).toHaveLength(1)
    expect(secondPage.body.nextCursor).toBeNull()
  })
})

describe('Validação de entrada', () => {
  it('rejects creating a payable without a required field', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .post('/payables')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', dueDate: '2099-01-01' })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid status filter', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .get('/payables?status=not-a-status')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })

  it('rejects an invalid amount on update', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)
    const res = await request(app)
      .patch(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -10 })
    expect(res.status).toBe(400)
  })

  it('rejects paying without an accountId', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)
    const res = await request(app)
      .post(`/payables/${created.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('rejects a non-boolean confirmDeleteTransaction on delete', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createStandalonePayable(token)
    const res = await request(app)
      .delete(`/payables/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmDeleteTransaction: 'yes' })
    expect(res.status).toBe(400)
  })

  it('rejects a summary request without until', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app).get('/payables/summary').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})

describe('GET /accounts com projected_balance (RF-11)', () => {
  it('subtracts pending expense payables and adds pending income payables of that account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token, { initialBalance: 1000 })
    await createStandalonePayable(token, {
      type: 'expense',
      amount: 200,
      dueDate: '2024-01-15',
      accountId: account,
    })
    await createStandalonePayable(token, {
      type: 'income',
      amount: 300,
      dueDate: '2024-01-20',
      accountId: account,
    })
    // No accountId — must not affect any single account's projection.
    await createStandalonePayable(token, { type: 'expense', amount: 5000, dueDate: '2024-01-01' })

    const res = await request(app)
      .get('/accounts?date=2024-02-01')
      .set('Authorization', `Bearer ${token}`)

    const found = res.body.find((a: { id: string }) => a.id === account)
    expect(found.currentBalance).toBe('1000')
    expect(found.projectedBalance).toBe('1100')
  })
})
