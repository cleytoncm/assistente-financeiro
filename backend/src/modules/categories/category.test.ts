import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { createAuthenticatedUser } from '../../test/authHelper.js'

const app = createApp()

describe('GET /categories', () => {
  it('lists the seeded catalog, visible to any authenticated user', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app).get('/categories').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.some((c: { name: string }) => c.name === 'Salário')).toBe(true)
    expect(res.body.some((c: { name: string }) => c.name === 'Alimentação')).toBe(true)
  })

  it('includes a category created by the user, but not other users’ categories', async () => {
    const userA = await createAuthenticatedUser(app)
    const userB = await createAuthenticatedUser(app)

    await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'Categoria da A', type: 'expense' })

    const resA = await request(app).get('/categories').set('Authorization', `Bearer ${userA.token}`)
    const resB = await request(app).get('/categories').set('Authorization', `Bearer ${userB.token}`)

    expect(resA.body.some((c: { name: string }) => c.name === 'Categoria da A')).toBe(true)
    expect(resB.body.some((c: { name: string }) => c.name === 'Categoria da A')).toBe(false)
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/categories')
    expect(res.status).toBe(401)
  })
})

describe('POST /categories', () => {
  it('creates a category owned by the user', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Minha Categoria', type: 'income' })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Minha Categoria', type: 'income' })
  })

  it('rejects a duplicate name+type for the same user', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicada', type: 'income' })

    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicada', type: 'income' })

    expect(res.status).toBe(409)
  })

  it('allows the same name with a different type', async () => {
    const { token } = await createAuthenticatedUser(app)
    await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mesma', type: 'income' })

    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mesma', type: 'expense' })

    expect(res.status).toBe(201)
  })

  it('rejects an invalid type', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inválida', type: 'not-a-type' })

    expect(res.status).toBe(400)
  })
})
