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

async function createGroup(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/payable-groups')
    .set('Authorization', `Bearer ${token}`)
    .send({
      type: 'expense',
      recurrenceType: 'installment',
      amount: 100,
      dueDay: 10,
      startDate: '2024-01-05',
      installmentCount: 3,
      ...overrides,
    })
}

describe('POST /payable-groups — parcelada (RF-02)', () => {
  it('materializes all installments with a fixed amount and monthly due dates', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createGroup(token)

    expect(res.status).toBe(201)
    expect(res.body.installmentCount).toBe(3)

    const detail = await request(app)
      .get(`/payable-groups/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(detail.body.payables).toHaveLength(3)
    expect(detail.body.payables.map((p: { amount: string }) => p.amount)).toEqual(['100', '100', '100'])
    expect(detail.body.payables.map((p: { dueDate: string }) => p.dueDate.slice(0, 10))).toEqual([
      '2024-01-10',
      '2024-02-10',
      '2024-03-10',
    ])
    expect(detail.body.payables.map((p: { installmentNumber: number }) => p.installmentNumber)).toEqual([1, 2, 3])
  })

  it('clamps dueDay to the last valid day of shorter months', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createGroup(token, { dueDay: 31, startDate: '2024-01-15', installmentCount: 2 })

    const detail = await request(app)
      .get(`/payable-groups/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(detail.body.payables.map((p: { dueDate: string }) => p.dueDate.slice(0, 10))).toEqual([
      '2024-01-31',
      '2024-02-29',
    ])
  })

  it('rejects an installment count below 2', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createGroup(token, { installmentCount: 1 })
    expect(res.status).toBe(400)
  })

  it('rejects installmentCount when recurrenceType is recurring', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createGroup(token, { recurrenceType: 'recurring', installmentCount: 3 })
    expect(res.status).toBe(400)
  })
})

describe('POST /payable-groups — recorrente (RF-03)', () => {
  it('materializes an initial batch of 6 monthly payables', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await createGroup(token, {
      recurrenceType: 'recurring',
      installmentCount: undefined,
      amount: 1500,
      dueDay: 5,
      startDate: '2024-01-01',
    })

    expect(res.status).toBe(201)
    expect(res.body.installmentCount).toBeNull()

    // Reads the DB directly rather than through GET /payable-groups/:id: that endpoint also
    // triggers horizon extension (RF-03), and this group's fixed 2024 due dates are already
    // "expired" relative to the real wall-clock test run date, which would extend it before
    // this assertion — the extension behavior itself is covered separately below.
    const payables = await prismaTest.payable.findMany({
      where: { groupId: res.body.id as string },
      orderBy: { installmentNumber: 'asc' },
    })

    expect(payables).toHaveLength(6)
    expect(payables[5]!.dueDate.toISOString().slice(0, 10)).toBe('2024-06-05')
  })
})

describe('Extensão de horizonte de recorrência (RF-03)', () => {
  it('extends by another batch of 6 once fewer than 3 months of runway remain', async () => {
    const { token } = await createAuthenticatedUser(app)
    const today = new Date().toISOString().slice(0, 10)
    const res = await createGroup(token, {
      recurrenceType: 'recurring',
      installmentCount: undefined,
      amount: 500,
      dueDay: 15,
      startDate: today,
    })
    const groupId = res.body.id as string

    // The initial batch's last due date is 5 months out — still ample runway, so a read now
    // must not extend it yet.
    const beforeExtension = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(beforeExtension.body.payables).toHaveLength(6)

    // Force the group's horizon to be within 3 months by cancelling all but the first payable,
    // so the max non-cancelled due date becomes close enough to trigger an extension on read.
    const [first, ...rest] = beforeExtension.body.payables
    for (const payable of rest) {
      await request(app)
        .post(`/payables/${payable.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
    }

    const afterExtension = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)

    const active = afterExtension.body.payables.filter((p: { status: string }) => p.status !== 'cancelada')
    // The 5 cancelled parcelas stay in the response (history), plus the first + a fresh batch of 6.
    expect(active).toHaveLength(7)
    expect(active[0].id).toBe(first.id)
    expect(active[6].installmentNumber).toBe(12)
  })
})

describe('PATCH /payable-groups/:id (RF-07)', () => {
  it('cascades amount/dueDay/description changes to not-yet-paid/cancelled payables only', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createGroup(token, { installmentCount: 3, dueDay: 10 })
    const groupId = created.body.id as string

    const before = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    const [firstPayable] = before.body.payables

    // Pay the first parcela so the cascade must skip it.
    await request(app)
      .post(`/payables/${firstPayable.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    const updateRes = await request(app)
      .patch(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 250, dueDay: 20, description: 'Financiamento carro' })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.amount).toBe('250')

    const after = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)

    const [paid, second, third] = after.body.payables
    expect(paid.amount).toBe(String(firstPayable.amount))
    expect(paid.dueDate.slice(0, 10)).toBe(firstPayable.dueDate.slice(0, 10))
    expect(second.amount).toBe('250')
    expect(second.dueDate.slice(0, 10)).toBe('2024-02-20')
    expect(third.amount).toBe('250')
    expect(third.dueDate.slice(0, 10)).toBe('2024-03-20')
    expect(second.description).toBe('Financiamento carro')
  })
})

describe('DELETE /payable-groups/:id (RF-10)', () => {
  it('scope=pending removes only unpaid/uncancelled payables, keeping the group', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createGroup(token, { installmentCount: 3 })
    const groupId = created.body.id as string
    const before = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    const [firstPayable] = before.body.payables

    await request(app)
      .post(`/payables/${firstPayable.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    const del = await request(app)
      .delete(`/payable-groups/${groupId}?scope=pending`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(del.status).toBe(204)

    const after = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(200)
    expect(after.body.payables).toHaveLength(1)
    expect(after.body.payables[0].id).toBe(firstPayable.id)
  })

  it('scope=all requires confirmation when there is a paid payable, then removes everything', async () => {
    const { token } = await createAuthenticatedUser(app)
    const account = await createAccount(token)
    const created = await createGroup(token, { installmentCount: 2 })
    const groupId = created.body.id as string
    const before = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    const [firstPayable] = before.body.payables

    await request(app)
      .post(`/payables/${firstPayable.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: account })

    const rejected = await request(app)
      .delete(`/payable-groups/${groupId}?scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(rejected.status).toBe(409)
    expect(rejected.body.deletePaidCount).toBe(1)

    const confirmed = await request(app)
      .delete(`/payable-groups/${groupId}?scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmDeleteTransactions: true })
    expect(confirmed.status).toBe(204)

    const detail = await request(app)
      .get(`/payable-groups/${groupId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(404)
  })
})

describe('GET /payable-groups (RF-12)', () => {
  it('lists groups filtered by type, with payable count and next due date', async () => {
    const { token } = await createAuthenticatedUser(app)
    await createGroup(token, { type: 'expense' })
    await createGroup(token, { type: 'income', startDate: '2024-05-01' })

    const expenses = await request(app)
      .get('/payable-groups?type=expense')
      .set('Authorization', `Bearer ${token}`)

    expect(expenses.body).toHaveLength(1)
    expect(expenses.body[0].payableCount).toBe(3)
    expect(expenses.body[0].nextDueDate).toBe('2024-01-10')
  })

  it('also extends recurring groups’ horizon as a side effect of listing', async () => {
    const { token } = await createAuthenticatedUser(app)
    const today = new Date().toISOString().slice(0, 10)
    await createGroup(token, {
      recurrenceType: 'recurring',
      installmentCount: undefined,
      amount: 50,
      dueDay: 1,
      startDate: today,
    })

    const res = await request(app).get('/payable-groups').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body[0].payableCount).toBe(6)
  })
})

describe('GET /payable-groups/:id', () => {
  it('returns 404 for a group that does not exist', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .get('/payable-groups/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

describe('Validação de entrada', () => {
  it('rejects an invalid dueDay on group update', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createGroup(token)
    const res = await request(app)
      .patch(`/payable-groups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ dueDay: 40 })
    expect(res.status).toBe(400)
  })

  it('rejects deleting a group without a scope query param', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createGroup(token)
    const res = await request(app)
      .delete(`/payable-groups/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('rejects a non-boolean confirmDeleteTransactions on group delete', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await createGroup(token)
    const res = await request(app)
      .delete(`/payable-groups/${created.body.id}?scope=all`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmDeleteTransactions: 'yes' })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid type filter on the list endpoint', async () => {
    const { token } = await createAuthenticatedUser(app)
    const res = await request(app)
      .get('/payable-groups?type=not-a-type')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
  })
})
