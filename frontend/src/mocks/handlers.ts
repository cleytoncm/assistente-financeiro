import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:3000'

type MockBank = { id: string; name: string; code: string }
type MockAccount = {
  id: string
  name: string
  bankId: string
  currency: string
  initialBalance: string
  isActive: boolean
  isHidden: boolean
  bank: MockBank
}
type MockCard = {
  id: string
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  linkedAccountId: string | null
  isActive: boolean
  isHidden: boolean
  linkedAccount: MockAccount | null
}
type MockCategory = { id: string; userId: string | null; name: string; type: 'income' | 'expense' }
type MockTransaction = {
  id: string
  type: 'income' | 'expense'
  amount: string
  date: string
  description: string
  categoryId: string | null
  accountId: string | null
  cardId: string | null
  refundOfTransactionId: string | null
  installmentGroupId: string | null
  installmentNumber: number | null
  installmentCount: number | null
  invoiceId: string | null
}
type InvoiceStatus = 'aberta' | 'fechada' | 'atrasada' | 'paga'
type MockInvoice = {
  id: string
  cardId: string
  periodYear: number
  periodMonth: number
  closingDate: string
  dueDate: string
  paidAt: string | null
  paymentAccountId: string | null
  paymentTransactionId: string | null
}

const DEFAULT_BANKS: MockBank[] = [{ id: 'seed-bank-1', name: 'Banco do Brasil', code: '001' }]
const DEFAULT_CATEGORIES: MockCategory[] = [
  { id: 'seed-cat-income-1', userId: null, name: 'Salário', type: 'income' },
  { id: 'seed-cat-expense-1', userId: null, name: 'Alimentação', type: 'expense' },
]

let banks: MockBank[] = []
let categories: MockCategory[] = []
let accounts: MockAccount[] = []
let cards: MockCard[] = []
let transactions: MockTransaction[] = []
let invoices: MockInvoice[] = []
let nextId = 1

export function resetMockData() {
  banks = DEFAULT_BANKS.map((b) => ({ ...b }))
  categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  accounts = []
  cards = []
  transactions = []
  invoices = []
  nextId = 1
}
resetMockData()

// Simplified invoice bucketing for mocked component tests: one invoice per (card, calendar
// month) of the transaction's own date, rather than the real closing-day-aware period math the
// backend uses — component tests only need internally consistent grouping/status, not
// bit-for-bit parity with the backend's billing-cycle rules.
function findOrCreateInvoice(cardId: string, date: string): MockInvoice {
  const [year, month] = date.slice(0, 7).split('-').map(Number)
  const existing = invoices.find(
    (i) => i.cardId === cardId && i.periodYear === year && i.periodMonth === month
  )
  if (existing) return existing

  const closingDate = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10)
  const dueDate = new Date(Date.UTC(year!, month!, 10)).toISOString().slice(0, 10)
  const invoice: MockInvoice = {
    id: `invoice-${nextId++}`,
    cardId,
    periodYear: year!,
    periodMonth: month!,
    closingDate,
    dueDate,
    paidAt: null,
    paymentAccountId: null,
    paymentTransactionId: null,
  }
  invoices.push(invoice)
  return invoice
}

function computeInvoiceStatus(invoice: MockInvoice): InvoiceStatus {
  if (invoice.paidAt) return 'paga'
  const today = new Date().toISOString().slice(0, 10)
  if (today <= invoice.closingDate) return 'aberta'
  if (today <= invoice.dueDate) return 'fechada'
  return 'atrasada'
}

function computeInvoiceTotal(invoiceId: string): number {
  return transactions
    .filter((t) => t.invoiceId === invoiceId)
    .reduce((acc, t) => acc + (t.type === 'expense' ? Number(t.amount) : -Number(t.amount)), 0)
}

function serializeInvoice(invoice: MockInvoice) {
  return { ...invoice, status: computeInvoiceStatus(invoice), total: computeInvoiceTotal(invoice.id).toString() }
}

function computeAccountBalance(account: MockAccount, date: string): string {
  const sum = transactions
    .filter((t) => t.accountId === account.id && t.date.slice(0, 10) <= date)
    .reduce((acc, t) => acc + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0)
  return (Number(account.initialBalance) + sum).toString()
}

function computeCardSpending(card: MockCard, date: string): { spending: string; available: string } {
  const sum = transactions
    .filter((t) => t.cardId === card.id && t.date.slice(0, 10) <= date)
    .reduce((acc, t) => acc + (t.type === 'expense' ? Number(t.amount) : -Number(t.amount)), 0)
  return { spending: sum.toString(), available: (Number(card.creditLimit) - sum).toString() }
}

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

  http.get(`${BASE_URL}/categories`, () => HttpResponse.json(categories)),

  http.post(`${BASE_URL}/categories`, async ({ request }) => {
    const body = (await request.json()) as { name: string; type: 'income' | 'expense' }
    const category: MockCategory = { id: `cat-${nextId++}`, userId: 'user-1', name: body.name, type: body.type }
    categories.push(category)
    return HttpResponse.json(category, { status: 201 })
  }),

  http.get(`${BASE_URL}/accounts`, ({ request }) => {
    const url = new URL(request.url)
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    const includeHidden = url.searchParams.get('includeHidden') === 'true'
    const visible = includeHidden ? accounts : accounts.filter((a) => !a.isHidden)
    return HttpResponse.json(
      visible.map((a) => ({ ...a, currentBalance: computeAccountBalance(a, date) }))
    )
  }),

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
      isActive: true,
      isHidden: false,
      bank,
    }
    accounts.push(account)
    return HttpResponse.json({ ...account, currentBalance: account.initialBalance }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/accounts/:id/status`, async ({ request, params }) => {
    const body = (await request.json()) as { isActive?: boolean; isHidden?: boolean }
    const account = accounts.find((a) => a.id === params.id)!
    if (body.isActive !== undefined) account.isActive = body.isActive
    if (body.isHidden !== undefined) account.isHidden = body.isHidden
    return HttpResponse.json(account)
  }),

  http.delete(`${BASE_URL}/accounts/:id`, ({ request, params }) => {
    const url = new URL(request.url)
    const cascade = url.searchParams.get('cascade') === 'true'
    const hasTransactions = transactions.some((t) => t.accountId === params.id)
    if (hasTransactions && !cascade) {
      return HttpResponse.json({ error: 'Account has transactions' }, { status: 409 })
    }
    accounts = accounts.filter((a) => a.id !== params.id)
    transactions = transactions.filter((t) => t.accountId !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/cards`, ({ request }) => {
    const url = new URL(request.url)
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    const includeHidden = url.searchParams.get('includeHidden') === 'true'
    const visible = includeHidden ? cards : cards.filter((c) => !c.isHidden)
    return HttpResponse.json(
      visible.map((c) => {
        const { spending, available } = computeCardSpending(c, date)
        return { ...c, currentSpending: spending, availableLimit: available }
      })
    )
  }),

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
      isActive: true,
      isHidden: false,
      linkedAccount,
    }
    cards.push(card)
    return HttpResponse.json({ ...card, currentSpending: '0', availableLimit: card.creditLimit }, { status: 201 })
  }),

  http.patch(`${BASE_URL}/cards/:id/status`, async ({ request, params }) => {
    const body = (await request.json()) as { isActive?: boolean; isHidden?: boolean }
    const card = cards.find((c) => c.id === params.id)!
    if (body.isActive !== undefined) card.isActive = body.isActive
    if (body.isHidden !== undefined) card.isHidden = body.isHidden
    return HttpResponse.json(card)
  }),

  http.delete(`${BASE_URL}/cards/:id`, ({ request, params }) => {
    const url = new URL(request.url)
    const cascade = url.searchParams.get('cascade') === 'true'
    const hasTransactions = transactions.some((t) => t.cardId === params.id)
    if (hasTransactions && !cascade) {
      return HttpResponse.json({ error: 'Card has transactions' }, { status: 409 })
    }
    cards = cards.filter((c) => c.id !== params.id)
    transactions = transactions.filter((t) => t.cardId !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/transactions`, ({ request }) => {
    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId')
    const cardId = url.searchParams.get('cardId')
    const categoryId = url.searchParams.get('categoryId')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const offset = Number(url.searchParams.get('offset') ?? '0')

    let filtered = transactions
    if (accountId) filtered = filtered.filter((t) => t.accountId === accountId)
    if (cardId) filtered = filtered.filter((t) => t.cardId === cardId)
    if (categoryId) filtered = filtered.filter((t) => t.categoryId === categoryId)

    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1))
    return HttpResponse.json({
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
    })
  }),

  http.post(`${BASE_URL}/transactions`, async ({ request }) => {
    const body = (await request.json()) as {
      type: 'income' | 'expense'
      amount: number
      date: string
      description: string
      categoryId?: string
      accountId?: string
      cardId?: string
      refundOfTransactionId?: string
      installments?: number
      confirmPaymentAdjustment?: boolean
    }

    if (body.installments) {
      const groupId = `group-${nextId++}`
      const created: MockTransaction[] = []
      const per = Math.floor((body.amount / body.installments) * 100) / 100
      let sum = 0
      for (let i = 0; i < body.installments; i++) {
        const isLast = i === body.installments - 1
        const amount = isLast ? body.amount - sum : per
        sum += per
        const date = new Date(body.date)
        date.setMonth(date.getMonth() + i)
        const isoDate = date.toISOString().slice(0, 10)
        const invoice = body.cardId ? findOrCreateInvoice(body.cardId, isoDate) : null
        const transaction: MockTransaction = {
          id: `txn-${nextId++}`,
          type: body.type,
          amount: amount.toFixed(2),
          date: isoDate,
          description: body.description,
          categoryId: body.categoryId ?? null,
          accountId: null,
          cardId: body.cardId ?? null,
          refundOfTransactionId: null,
          installmentGroupId: groupId,
          installmentNumber: i + 1,
          installmentCount: body.installments,
          invoiceId: invoice?.id ?? null,
        }
        transactions.push(transaction)
        created.push(transaction)
      }
      return HttpResponse.json(created, { status: 201 })
    }

    const invoice = body.cardId ? findOrCreateInvoice(body.cardId, body.date) : null
    if (invoice?.paidAt) {
      const oldAmount = computeInvoiceTotal(invoice.id)
      const delta = body.type === 'expense' ? body.amount : -body.amount
      const newAmount = oldAmount + delta
      if (!body.confirmPaymentAdjustment) {
        return HttpResponse.json(
          {
            error: 'This invoice is already paid; confirm to update the payment amount',
            invoicePaymentAdjustment: {
              invoiceId: invoice.id,
              oldAmount: oldAmount.toString(),
              newAmount: newAmount.toString(),
            },
          },
          { status: 409 }
        )
      }
    }

    const transaction: MockTransaction = {
      id: `txn-${nextId++}`,
      type: body.type,
      amount: body.amount.toFixed(2),
      date: body.date,
      description: body.description,
      categoryId: body.categoryId ?? null,
      accountId: body.accountId ?? null,
      cardId: body.cardId ?? null,
      refundOfTransactionId: body.refundOfTransactionId ?? null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentCount: null,
      invoiceId: invoice?.id ?? null,
    }
    transactions.push(transaction)

    if (invoice?.paidAt && invoice.paymentTransactionId) {
      const paymentTransaction = transactions.find((t) => t.id === invoice.paymentTransactionId)
      if (paymentTransaction) paymentTransaction.amount = computeInvoiceTotal(invoice.id).toString()
    }

    return HttpResponse.json(transaction, { status: 201 })
  }),

  http.patch(`${BASE_URL}/transactions/:id`, async ({ request, params }) => {
    const url = new URL(request.url)
    const applyToRemaining = url.searchParams.get('applyToRemaining') === 'true'
    const body = (await request.json()) as Partial<MockTransaction>
    const transaction = transactions.find((t) => t.id === params.id)!

    if (transaction.invoiceId) {
      const invoice = invoices.find((i) => i.id === transaction.invoiceId)
      if (invoice && computeInvoiceStatus(invoice) !== 'aberta') {
        return HttpResponse.json(
          { error: 'This transaction belongs to an invoice that is no longer open' },
          { status: 409 }
        )
      }
    }

    const originalDate = transaction.date
    Object.assign(transaction, body)

    if (applyToRemaining && transaction.installmentGroupId) {
      for (const sibling of transactions) {
        if (
          sibling.installmentGroupId === transaction.installmentGroupId &&
          sibling.id !== transaction.id &&
          sibling.date >= originalDate
        ) {
          Object.assign(sibling, body)
        }
      }
    }

    return HttpResponse.json(transaction)
  }),

  http.delete(`${BASE_URL}/transactions/:id`, ({ request, params }) => {
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'single'
    const transaction = transactions.find((t) => t.id === params.id)
    if (!transaction) {
      return HttpResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction.invoiceId) {
      const invoice = invoices.find((i) => i.id === transaction.invoiceId)
      if (invoice && computeInvoiceStatus(invoice) !== 'aberta') {
        return HttpResponse.json(
          { error: 'This transaction belongs to an invoice that is no longer open' },
          { status: 409 }
        )
      }
    }

    if (scope === 'remaining' && transaction.installmentGroupId) {
      transactions = transactions.filter(
        (t) => !(t.installmentGroupId === transaction.installmentGroupId && t.date >= transaction.date)
      )
    } else {
      transactions = transactions.filter((t) => t.id !== params.id)
    }

    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/cards/:id/invoices`, ({ params }) => {
    const list = invoices
      .filter((i) => i.cardId === params.id)
      .sort((a, b) => a.periodYear - b.periodYear || a.periodMonth - b.periodMonth)
    return HttpResponse.json(list.map(serializeInvoice))
  }),

  http.get(`${BASE_URL}/invoices/:id`, ({ params }) => {
    const invoice = invoices.find((i) => i.id === params.id)
    if (!invoice) return HttpResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return HttpResponse.json(serializeInvoice(invoice))
  }),

  http.get(`${BASE_URL}/invoices/:id/transactions`, ({ params }) => {
    const items = transactions.filter((t) => t.invoiceId === params.id)
    return HttpResponse.json({ items, total: items.length })
  }),

  http.patch(`${BASE_URL}/invoices/:id`, async ({ request, params }) => {
    const invoice = invoices.find((i) => i.id === params.id)
    if (!invoice) return HttpResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.paidAt) return HttpResponse.json({ error: 'Invoice is already paid' }, { status: 409 })

    const body = (await request.json()) as { closingDate?: string; dueDate?: string }
    const closingDate = body.closingDate ?? invoice.closingDate
    const dueDate = body.dueDate ?? invoice.dueDate
    if (closingDate >= dueDate) {
      return HttpResponse.json({ error: 'closingDate must be before dueDate' }, { status: 409 })
    }
    invoice.closingDate = closingDate
    invoice.dueDate = dueDate
    return HttpResponse.json(serializeInvoice(invoice))
  }),

  http.post(`${BASE_URL}/invoices/:id/pay`, async ({ request, params }) => {
    const invoice = invoices.find((i) => i.id === params.id)
    if (!invoice) return HttpResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.paidAt) return HttpResponse.json({ error: 'Invoice is already paid' }, { status: 409 })

    const body = (await request.json()) as { accountId: string }
    const account = accounts.find((a) => a.id === body.accountId)
    if (!account) return HttpResponse.json({ error: 'Payment account not found' }, { status: 400 })

    const total = computeInvoiceTotal(invoice.id)
    const paymentTransaction: MockTransaction = {
      id: `txn-${nextId++}`,
      type: 'expense',
      amount: total.toString(),
      date: new Date().toISOString().slice(0, 10),
      description: 'Pagamento de fatura',
      categoryId: null,
      accountId: account.id,
      cardId: null,
      refundOfTransactionId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentCount: null,
      invoiceId: null,
    }
    transactions.push(paymentTransaction)

    invoice.paidAt = new Date().toISOString()
    invoice.paymentAccountId = account.id
    invoice.paymentTransactionId = paymentTransaction.id

    return HttpResponse.json(serializeInvoice(invoice))
  }),
]
