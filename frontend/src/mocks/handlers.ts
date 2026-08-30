import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:3000'

export const handlers = [
  http.post(`${BASE_URL}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { name: string; email: string; password: string }
    if (body.email === 'duplicado@example.com') {
      return HttpResponse.json({ error: 'Email already exists' }, { status: 409 })
    }
    return HttpResponse.json(
      { id: 'user-1', name: body.name, email: body.email.toLowerCase() },
      { status: 201 }
    )
  }),

  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    if (body.password === 'wrongpassword') {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    return HttpResponse.json({ token: 'fake-jwt-token' }, { status: 200 })
  }),

  http.get(`${BASE_URL}/auth/me`, ({ request }) => {
    const auth = request.headers.get('authorization')
    if (!auth) {
      return HttpResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    return HttpResponse.json({ id: 'user-1', name: 'Ana', email: 'ana@example.com' })
  }),
]
