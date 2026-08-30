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
    .send({
      name: `Cartão ${Date.now()}-${Math.random()}`,
      creditLimit: 5000,
      closingDay: 10,
      dueDay: 20,
      ...overrides,
    })
  return res.body.id as string
}

describe('POST /transactions (avulso)', () => {
  it('creates an expense on an account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'Mercado', accountId })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ type: 'expense', description: 'Mercado', accountId })
  })

  it('creates an income on a card (e.g. a standalone refund)', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'income', amount: 20, date: '2024-03-10', description: 'Estorno', cardId })

    expect(res.status).toBe(201)
    expect(res.body.cardId).toBe(cardId)
  })

  it('rejects a transaction with both accountId and cardId', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const cardId = await createCard(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId, cardId })

    expect(res.status).toBe(400)
  })

  it('rejects a transaction with neither accountId nor cardId', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X' })

    expect(res.status).toBe(400)
  })

  it('rejects an invalid type', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'invalid', amount: 50, date: '2024-03-10', description: 'X', accountId })

    expect(res.status).toBe(400)
  })

  it('rejects an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(userA.token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    expect(res.status).toBe(404)
  })

  it('rejects a deactivated account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    await request(app)
      .patch(`/accounts/${accountId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    expect(res.status).toBe(409)
  })

  it('creates a transaction with a matching category', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const category = await prismaTest.category.findFirstOrThrow({ where: { name: 'Alimentação' } })

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 50,
        date: '2024-03-10',
        description: 'X',
        accountId,
        categoryId: category.id,
      })

    expect(res.status).toBe(201)
    expect(res.body.categoryId).toBe(category.id)
  })

  it('rejects a category whose type does not match the transaction type', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const category = await prismaTest.category.findFirstOrThrow({ where: { name: 'Salário' } })

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 50,
        date: '2024-03-10',
        description: 'X',
        accountId,
        categoryId: category.id,
      })

    expect(res.status).toBe(409)
  })

  it('rejects a non-existent category', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 50,
        date: '2024-03-10',
        description: 'X',
        accountId,
        categoryId: 'does-not-exist',
      })

    expect(res.status).toBe(400)
  })
})

describe('POST /transactions (estorno — RF-06)', () => {
  async function createOriginal(token: string, accountId: string, amount = 100) {
    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount, date: '2024-03-01', description: 'Compra', accountId })
    return res.body.id as string
  }

  it('accepts a refund with opposite type, same account, amount <= original', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const originalId = await createOriginal(token, accountId)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        amount: 100,
        date: '2024-03-05',
        description: 'Estorno',
        accountId,
        refundOfTransactionId: originalId,
      })

    expect(res.status).toBe(201)
  })

  it('rejects a refund with the same type as the original', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const originalId = await createOriginal(token, accountId)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 100,
        date: '2024-03-05',
        description: 'Estorno',
        accountId,
        refundOfTransactionId: originalId,
      })

    expect(res.status).toBe(400)
  })

  it('rejects a refund on a different account than the original', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const otherAccountId = await createAccount(token)
    const originalId = await createOriginal(token, accountId)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        amount: 100,
        date: '2024-03-05',
        description: 'Estorno',
        accountId: otherAccountId,
        refundOfTransactionId: originalId,
      })

    expect(res.status).toBe(400)
  })

  it('rejects a refund amount greater than the original', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const originalId = await createOriginal(token, accountId, 50)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        amount: 60,
        date: '2024-03-05',
        description: 'Estorno',
        accountId,
        refundOfTransactionId: originalId,
      })

    expect(res.status).toBe(400)
  })

  it('rejects a refund pointing to a non-existent transaction', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'income',
        amount: 50,
        date: '2024-03-05',
        description: 'Estorno',
        accountId,
        refundOfTransactionId: 'does-not-exist',
      })

    expect(res.status).toBe(400)
  })
})

describe('POST /transactions (parcelamento — RF-02)', () => {
  it('splits the total into N installments on a card', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 100,
        date: '2024-03-10',
        description: 'Compra parcelada',
        cardId,
        installments: 3,
      })

    expect(res.status).toBe(201)
    expect(res.body).toHaveLength(3)
    expect(res.body.map((t: { amount: string }) => t.amount)).toEqual(['33.33', '33.33', '33.34'])
    expect(res.body.map((t: { installmentNumber: number }) => t.installmentNumber)).toEqual([1, 2, 3])
    expect(res.body.map((t: { date: string }) => t.date.slice(0, 10))).toEqual([
      '2024-03-10',
      '2024-04-10',
      '2024-05-10',
    ])
    expect(new Set(res.body.map((t: { installmentGroupId: string }) => t.installmentGroupId)).size).toBe(1)
  })

  it('rejects installments on an account (not a card)', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)

    const res = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 100,
        date: '2024-03-10',
        description: 'X',
        accountId,
        installments: 3,
      })

    expect(res.status).toBe(400)
  })
})

describe('GET /transactions (RF-07)', () => {
  it('paginates and isolates by user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountA = await createAccount(userA.token)
    const accountB = await createAccount(userB.token)

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/transactions')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ type: 'expense', amount: 10, date: '2024-03-10', description: `A${i}`, accountId: accountA })
    }
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ type: 'expense', amount: 10, date: '2024-03-10', description: 'B', accountId: accountB })

    const res = await request(app)
      .get('/transactions?limit=2&offset=0')
      .set('Authorization', `Bearer ${userA.token}`)

    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(2)
    expect(res.body.total).toBe(3)
  })

  it('filters by account, category and date range', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const otherAccountId = await createAccount(token)
    const category = await prismaTest.category.findFirstOrThrow({ where: { name: 'Transporte' } })

    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 10,
        date: '2024-03-10',
        description: 'Match',
        accountId,
        categoryId: category.id,
      })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 10, date: '2024-01-01', description: 'OutOfRange', accountId })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 10, date: '2024-03-10', description: 'OtherAccount', accountId: otherAccountId })

    const res = await request(app)
      .get(`/transactions?accountId=${accountId}&categoryId=${category.id}&from=2024-03-01&to=2024-03-31`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].description).toBe('Match')
  })
})

describe('PATCH /transactions/:id (RF-04)', () => {
  it('edits a simple field', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'Old', accountId })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'New' })

    expect(res.status).toBe(200)
    expect(res.body.description).toBe('New')
  })

  it('applies the change to remaining installments when applyToRemaining=true', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 300,
        date: '2024-03-10',
        description: 'Parcelado',
        cardId,
        installments: 3,
      })
    const secondInstallment = created.body[1]

    await request(app)
      .patch(`/transactions/${secondInstallment.id}?applyToRemaining=true`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Renegociado' })

    const list = await request(app)
      .get(`/transactions?cardId=${cardId}`)
      .set('Authorization', `Bearer ${token}`)

    const descriptions = list.body.items
      .sort((a: { installmentNumber: number }, b: { installmentNumber: number }) => a.installmentNumber - b.installmentNumber)
      .map((t: { description: string }) => t.description)
    expect(descriptions).toEqual(['Parcelado', 'Renegociado', 'Renegociado'])
  })

  it('does not touch past installments even with applyToRemaining=true', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 300,
        date: '2024-03-10',
        description: 'Parcelado',
        cardId,
        installments: 3,
      })
    const secondInstallment = created.body[1]

    await request(app)
      .patch(`/transactions/${secondInstallment.id}?applyToRemaining=true`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Renegociado' })

    const list = await request(app)
      .get(`/transactions?cardId=${cardId}`)
      .set('Authorization', `Bearer ${token}`)
    const firstItem = list.body.items.find((t: { id: string }) => t.id === created.body[0].id)
    expect(firstItem.description).toBe('Parcelado')
  })

  it('returns 404 for a transaction belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(userA.token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ description: 'Hack' })

    expect(res.status).toBe(404)
  })

  it('rejects an invalid body', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -10 })

    expect(res.status).toBe(400)
  })

  it('moves the transaction to another owned account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const otherAccountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ accountId: otherAccountId })

    expect(res.status).toBe(200)
    expect(res.body.accountId).toBe(otherAccountId)
    expect(res.body.cardId).toBeNull()
  })

  it('rejects moving the transaction to an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(userA.token)
    const otherUsersAccountId = await createAccount(userB.token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ accountId: otherUsersAccountId })

    expect(res.status).toBe(404)
  })

  it('updates the category, validating it matches the effective type', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })
    const category = await prismaTest.category.findFirstOrThrow({ where: { name: 'Transporte' } })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId: category.id })

    expect(res.status).toBe(200)
    expect(res.body.categoryId).toBe(category.id)
  })

  it('rejects a category whose type does not match on update', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })
    const category = await prismaTest.category.findFirstOrThrow({ where: { name: 'Salário' } })

    const res = await request(app)
      .patch(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId: category.id })

    expect(res.status).toBe(409)
  })
})

describe('GET /transactions — validação de query', () => {
  it('rejects an invalid query', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .get('/transactions?limit=9999')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

describe('DELETE /transactions/:id (RF-05)', () => {
  it('deletes a single transaction by default', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .delete(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })

  it('deletes this and remaining installments with scope=remaining', async () => {
    const { token } = await createAuthenticatedUser(app)
    const cardId = await createCard(token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 300,
        date: '2024-03-10',
        description: 'Parcelado',
        cardId,
        installments: 3,
      })
    const secondInstallment = created.body[1]

    await request(app)
      .delete(`/transactions/${secondInstallment.id}?scope=remaining`)
      .set('Authorization', `Bearer ${token}`)

    const list = await request(app)
      .get(`/transactions?cardId=${cardId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.body.items).toHaveLength(1)
    expect(list.body.items[0].installmentNumber).toBe(1)
  })

  it('returns 404 for a transaction belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(userA.token)
    const created = await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ type: 'expense', amount: 50, date: '2024-03-10', description: 'X', accountId })

    const res = await request(app)
      .delete(`/transactions/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)

    expect(res.status).toBe(404)
  })
})
