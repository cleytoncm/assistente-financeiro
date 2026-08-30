import { describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../../app.js'
import { env } from '../../config/env.js'

const app = createApp()

describe('POST /auth/register', () => {
  it('creates a new user and returns 201', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ana',
      email: 'Ana@Example.com',
      password: 'password123',
    })

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Ana', email: 'ana@example.com' })
    expect(res.body.id).toBeDefined()
    expect(res.body.passwordHash).toBeUndefined()
  })

  it('rejects a duplicate email (case-insensitive)', async () => {
    await request(app).post('/auth/register').send({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'password123',
    })

    const res = await request(app).post('/auth/register').send({
      name: 'Outra Ana',
      email: 'ANA@EXAMPLE.COM',
      password: 'password456',
    })

    expect(res.status).toBe(409)
  })

  it('rejects a password shorter than 8 characters', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ana',
      email: 'ana2@example.com',
      password: 'short',
    })

    expect(res.status).toBe(400)
  })

  it('rejects an invalid email', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Ana',
      email: 'not-an-email',
      password: 'password123',
    })

    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  async function registerUser(email: string, password: string) {
    await request(app).post('/auth/register').send({ name: 'Ana', email, password })
  }

  it('logs in with valid credentials and returns a token', async () => {
    await registerUser('login@example.com', 'password123')

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
  })

  it('logs in with an email in a different case than registered', async () => {
    await registerUser('caselogin@example.com', 'password123')

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'CaseLogin@Example.com', password: 'password123' })

    expect(res.status).toBe(200)
  })

  it('rejects a wrong password with a generic error', async () => {
    await registerUser('wrongpass@example.com', 'password123')

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.error).not.toMatch(/email/i)
  })

  it('rejects an email that does not exist with the same generic error', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'doesnotexist@example.com', password: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.error).not.toMatch(/email/i)
  })

  it('rejects an invalid email format with 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'password123' })

    expect(res.status).toBe(400)
  })
})

describe('GET /auth/me', () => {
  async function registerAndLogin(email: string, password: string) {
    await request(app).post('/auth/register').send({ name: 'Ana', email, password })
    const loginRes = await request(app).post('/auth/login').send({ email, password })
    return loginRes.body.token as string
  }

  it('returns the authenticated user data', async () => {
    const token = await registerAndLogin('me@example.com', 'password123')

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Ana', email: 'me@example.com' })
  })

  it('rejects a request without a token', async () => {
    const res = await request(app).get('/auth/me')
    expect(res.status).toBe(401)
  })

  it('rejects a request with an invalid token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid-token')
    expect(res.status).toBe(401)
  })

  it('rejects a well-formed token for a user that no longer exists', async () => {
    const token = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000' }, env.jwtSecret, {
      expiresIn: '1h',
    })

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(401)
  })
})
