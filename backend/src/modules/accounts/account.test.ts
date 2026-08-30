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

describe('POST /accounts', () => {
  it('creates an account with the given initial balance', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Corrente', bankId, initialBalance: 100 })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Conta Corrente', currency: 'BRL' })
    expect(res.body.bank.code).toBe('001')
  })

  it('allows a negative initial balance', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cheque Especial', bankId, initialBalance: -50.5 })

    expect(res.status).toBe(201)
  })

  it('accepts a custom currency and uppercases it', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Dólar', bankId, initialBalance: 0, currency: 'usd' })

    expect(res.status).toBe(201)
    expect(res.body.currency).toBe('USD')
  })

  it('rejects a duplicate account name for the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Corrente', bankId, initialBalance: 0 })

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta Corrente', bankId, initialBalance: 0 })

    expect(res.status).toBe(409)
  })

  it('allows the same account name for two different users', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)

    await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Conta Corrente', bankId, initialBalance: 0 })

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'Conta Corrente', bankId, initialBalance: 0 })

    expect(res.status).toBe(201)
  })

  it('rejects a non-existent bank', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta X', bankId: 'does-not-exist', initialBalance: 0 })

    expect(res.status).toBe(400)
  })

  it('requires authentication', async () => {
    const res = await request(app).post('/accounts').send({ name: 'X', bankId, initialBalance: 0 })
    expect(res.status).toBe(401)
  })

  it('rejects an invalid body', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', bankId, initialBalance: 0 })

    expect(res.status).toBe(400)
  })
})

describe('GET /accounts', () => {
  it('lists only the authenticated user accounts', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)

    await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Conta A', bankId, initialBalance: 0 })
    await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'Conta B', bankId, initialBalance: 0 })

    const res = await request(app).get('/accounts').set('Authorization', `Bearer ${userA.token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Conta A')
    expect(res.body[0].bank.code).toBe('001')
  })
})

describe('PATCH /accounts/:id', () => {
  it('updates the account name', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Antigo', bankId, initialBalance: 0 })

    const res = await request(app)
      .patch(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Novo' })

    expect(res.body.bank.code).toBe('001')

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Nome Novo')
  })

  it('returns 404 for an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Conta A', bankId, initialBalance: 0 })

    const res = await request(app)
      .patch(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ name: 'Hackeado' })

    expect(res.status).toBe(404)
  })

  it('rejects an invalid body', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta', bankId, initialBalance: 0 })

    const res = await request(app)
      .patch(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' })

    expect(res.status).toBe(400)
  })

  it('rejects renaming to a name already used by another account of the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta 1', bankId, initialBalance: 0 })
    const created2 = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta 2', bankId, initialBalance: 0 })

    const res = await request(app)
      .patch(`/accounts/${created2.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta 1' })

    expect(res.status).toBe(409)
  })

  it('rejects updating to a non-existent bank', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta', bankId, initialBalance: 0 })

    const res = await request(app)
      .patch(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bankId: 'does-not-exist' })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /accounts/:id', () => {
  it('deletes the account', async () => {
    const { token } = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Conta a remover', bankId, initialBalance: 0 })

    const res = await request(app)
      .delete(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(204)

    const listRes = await request(app).get('/accounts').set('Authorization', `Bearer ${token}`)
    expect(listRes.body).toHaveLength(0)
  })

  it('returns 404 for an account belonging to another user', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)
    const created = await request(app)
      .post('/accounts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Conta A', bankId, initialBalance: 0 })

    const res = await request(app)
      .delete(`/accounts/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)

    expect(res.status).toBe(404)
  })
})
