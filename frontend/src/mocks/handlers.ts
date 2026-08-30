import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:3000'

type MockBank = { id: string; name: string; code: string }
type MockAccount = {
  id: string
  name: string
  bankId: string
  currency: string
  initialBalance: string
  bank: MockBank
}
type MockCard = {
  id: string
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  linkedAccountId: string | null
  linkedAccount: MockAccount | null
}

const DEFAULT_BANKS: MockBank[] = [{ id: 'seed-bank-1', name: 'Banco do Brasil', code: '001' }]

let banks: MockBank[] = []
let accounts: MockAccount[] = []
let cards: MockCard[] = []
let nextId = 1

export function resetMockData() {
  banks = DEFAULT_BANKS.map((b) => ({ ...b }))
  accounts = []
  cards = []
  nextId = 1
}
resetMockData()

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

  http.get(`${BASE_URL}/banks`, () => HttpResponse.json(banks)),

  http.post(`${BASE_URL}/banks`, async ({ request }) => {
    const body = (await request.json()) as { name: string; code: string }
    const bank: MockBank = { id: `bank-${nextId++}`, name: body.name, code: body.code }
    banks.push(bank)
    return HttpResponse.json(bank, { status: 201 })
  }),

  http.get(`${BASE_URL}/accounts`, () => HttpResponse.json(accounts)),

  http.post(`${BASE_URL}/accounts`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      bankId: string
      currency?: string
      initialBalance: number
    }
    const bank = banks.find((b) => b.id === body.bankId)!
    const account: MockAccount = {
      id: `account-${nextId++}`,
      name: body.name,
      bankId: body.bankId,
      currency: body.currency ?? 'BRL',
      initialBalance: String(body.initialBalance),
      bank,
    }
    accounts.push(account)
    return HttpResponse.json(account, { status: 201 })
  }),

  http.delete(`${BASE_URL}/accounts/:id`, ({ params }) => {
    accounts = accounts.filter((a) => a.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/cards`, () => HttpResponse.json(cards)),

  http.post(`${BASE_URL}/cards`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string
      creditLimit: number
      closingDay: number
      dueDay: number
      linkedAccountId?: string
    }
    const linkedAccount = body.linkedAccountId
      ? (accounts.find((a) => a.id === body.linkedAccountId) ?? null)
      : null
    const card: MockCard = {
      id: `card-${nextId++}`,
      name: body.name,
      creditLimit: String(body.creditLimit),
      closingDay: body.closingDay,
      dueDay: body.dueDay,
      linkedAccountId: body.linkedAccountId ?? null,
      linkedAccount,
    }
    cards.push(card)
    return HttpResponse.json(card, { status: 201 })
  }),

  http.delete(`${BASE_URL}/cards/:id`, ({ params }) => {
    cards = cards.filter((c) => c.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
]
