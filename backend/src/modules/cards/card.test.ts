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

async function createAccount(app: Parameters<typeof request>[0], token: string, name = 'Conta') {
  const res = await request(app)
    .post('/accounts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, bankId, initialBalance: 0 })
  return res.body.id as string
}

describe('POST /cards', () => {
  it('creates a card without a linked account', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Sem Vínculo', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    expect(res.status).toBe(201)
    expect(res.body.linkedAccountId).toBeNull()
  })

  it('creates a card linked to an existing account of the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(app, token)

    const res = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Vinculado', creditLimit: 1000, closingDay: 10, dueDay: 20, linkedAccountId: accountId })

    expect(res.status).toBe(201)
    expect(res.body.linkedAccountId).toBe(accountId)
    expect(res.body.linkedAccount.id).toBe(accountId)
  })

  it('rejects linking to an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(app, userA.token)

    const res = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20, linkedAccountId: accountId })

    expect(res.status).toBe(400)
  })

  it('rejects an out-of-range closing day', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 35, dueDay: 20 })

    expect(res.status).toBe(400)
  })

  it('rejects a duplicate card name for the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    expect(res.status).toBe(409)
  })

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/cards')
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    expect(res.status).toBe(401)
  })
})

describe('GET /cards', () => {
  it('includes the linked account data', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(app, token, 'Conta Vinculada')
    await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20, linkedAccountId: accountId })

    const res = await request(app).get('/cards').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body[0].linkedAccount.name).toBe('Conta Vinculada')
  })
})

describe('PATCH /cards/:id', () => {
  it('updates the credit limit', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ creditLimit: 2000 })

    expect(res.status).toBe(200)
    expect(Number(res.body.creditLimit)).toBe(2000)
  })

  it('returns 404 for a card belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ creditLimit: 2000 })

    expect(res.status).toBe(404)
  })

  it('rejects an invalid body', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closingDay: 40 })

    expect(res.status).toBe(400)
  })

  it('rejects renaming to a name already used by another card of the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão 1', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    const created2 = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão 2', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created2.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão 1' })

    expect(res.status).toBe(409)
  })

  it('rejects linking to an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const accountId = await createAccount(app, userA.token)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ linkedAccountId: accountId })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /cards/:id', () => {
  it('deletes the card', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .delete(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })

  it('returns 404 for a card belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .delete(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)

    expect(res.status).toBe(404)
  })
})

describe('deleting a linked account', () => {
  it('unlinks the card instead of blocking the deletion', async () => {
    const { token } = await createAuthenticatedUser(app)
    const accountId = await createAccount(app, token)
    const card = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', creditLimit: 1000, closingDay: 10, dueDay: 20, linkedAccountId: accountId })

    await request(app).delete(`/accounts/${accountId}`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get('/cards').set('Authorization', `Bearer ${token}`)
    const updatedCard = res.body.find((c: { id: string }) => c.id === card.body.id)
    expect(updatedCard.linkedAccountId).toBeNull()
  })
})

describe('GET /cards — gasto e limite (RF-10)', () => {
  it('computes currentSpending and availableLimit from transactions up to today', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Gasto', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 300, date: '2020-01-01', description: 'X', cardId: created.body.id })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'income', amount: 50, date: '2020-01-01', description: 'Estorno', cardId: created.body.id })

    const res = await request(app).get('/cards').set('Authorization', `Bearer ${token}`)
    const card = res.body.find((c: { id: string }) => c.id === created.body.id)
    expect(card.currentSpending).toBe('250')
    expect(card.availableLimit).toBe('750')
  })

  it('ignores transactions after the requested date', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Futuro', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 300, date: '2030-01-01', description: 'X', cardId: created.body.id })

    const res = await request(app)
      .get('/cards?date=2024-01-01')
      .set('Authorization', `Bearer ${token}`)
    const card = res.body.find((c: { id: string }) => c.id === created.body.id)
    expect(card.currentSpending).toBe('0')
  })
})

describe('PATCH /cards/:id/status (RF-08)', () => {
  it('a hidden card is excluded from the default listing but included with includeHidden=true', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Oculto', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await request(app)
      .patch(`/cards/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isHidden: true })

    const hiddenFromDefault = await request(app).get('/cards').set('Authorization', `Bearer ${token}`)
    expect(hiddenFromDefault.body.some((c: { id: string }) => c.id === created.body.id)).toBe(false)

    const withHidden = await request(app)
      .get('/cards?includeHidden=true')
      .set('Authorization', `Bearer ${token}`)
    expect(withHidden.body.some((c: { id: string }) => c.id === created.body.id)).toBe(true)
  })

  it('rejects an invalid body', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Status Invalido', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: 'not-a-boolean' })

    expect(res.status).toBe(400)
  })

  it('returns 404 for a card belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Cartão A', creditLimit: 1000, closingDay: 10, dueDay: 20 })

    const res = await request(app)
      .patch(`/cards/${created.body.id}/status`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ isActive: false })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /cards/:id — com lançamentos (RF-09)', () => {
  it('blocks deletion without cascade when there are transactions', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Com Lancamento', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 10, date: '2024-01-01', description: 'X', cardId: created.body.id })

    const res = await request(app)
      .delete(`/cards/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
  })

  it('deletes the card and its transactions with cascade=true', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão Cascata', creditLimit: 1000, closingDay: 10, dueDay: 20 })
    await request(app)
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'expense', amount: 10, date: '2024-01-01', description: 'X', cardId: created.body.id })

    const res = await request(app)
      .delete(`/cards/${created.body.id}?cascade=true`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)
  })
})
