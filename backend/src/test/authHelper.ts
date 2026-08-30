import request from 'supertest'
import type { Express } from 'express'

let counter = 0

export async function createAuthenticatedUser(
  app: Express
): Promise<{ userId: string; token: string }> {
  counter += 1
  const email = `test-user-${Date.now()}-${counter}@example.com`
  const password = 'password123'

  const registerRes = await request(app)
    .post('/auth/register')
    .send({ name: 'Test User', email, password })

  const loginRes = await request(app).post('/auth/login').send({ email, password })

  return { userId: registerRes.body.id, token: loginRes.body.token }
}
