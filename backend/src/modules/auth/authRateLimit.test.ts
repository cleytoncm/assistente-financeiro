import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../app.js'

const app = createApp()

describe('rate limiting on /auth/login', () => {
  it('returns 429 after exceeding the attempt limit for the same IP+email', async () => {
    const credentials = { email: 'ratelimit@example.com', password: 'wrongpassword' }

    let lastStatus = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await request(app).post('/auth/login').send(credentials)
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })

  it('does not rate-limit a different email from attempts made against another one', async () => {
    await request(app)
      .post('/auth/login')
      .send({ email: 'someoneelse@example.com', password: 'wrongpassword' })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'freshemail@example.com', password: 'wrongpassword' })

    expect(res.status).not.toBe(429)
  })

  it('does not crash when the request body has no email', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'wrongpassword' })
    expect(res.status).toBe(400)
  })
})
