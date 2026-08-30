import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'
import { createAuthenticatedUser } from '../../test/authHelper.js'

const app = createApp()

describe('GET /banks', () => {
  it('lists the seeded bank catalog', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app).get('/banks').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body.some((bank: { code: string }) => bank.code === '001')).toBe(true)
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/banks')
    expect(res.status).toBe(401)
  })
})

describe('POST /banks', () => {
  it('creates a new bank', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Banco Teste', code: `TEST-${Date.now()}` })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Banco Teste')
  })

  it('rejects a duplicate bank code', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Banco do Brasil (duplicado)', code: '001' })

    expect(res.status).toBe(409)
  })

  it('rejects an empty name', async () => {
    const { token } = await createAuthenticatedUser(app)

    const res = await request(app)
      .post('/banks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', code: `TEST2-${Date.now()}` })

    expect(res.status).toBe(400)
  })
})
