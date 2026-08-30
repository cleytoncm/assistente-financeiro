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
type PayableStatus = 'pendente' | 'vence_hoje' | 'atrasada' | 'paga' | 'cancelada'
type MockPayableGroup = {
  id: string
  type: 'income' | 'expense'
  recurrenceType: 'installment' | 'recurring'
  installmentCount: number | null
  amount: string
  dueDay: number
  description: string | null
  counterparty: string | null
  accountId: string | null
}
type MockPayable = {
  id: string
  groupId: string | null
  type: 'income' | 'expense'
  amount: string
  dueDate: string
  installmentNumber: number | null
  description: string | null
  counterparty: string | null
  accountId: string | null
  paidAmount: string | null
  paidTransactionId: string | null
  paidAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

const DEFAULT_BANKS: MockBank[] = [{ id: 'seed-bank-1', name: 'Banco do Brasil', code: '001' }]
const DEFAULT_CATEGORIES: MockCategory[] = [
  { id: 'seed-cat-income-1', userId: null, name: 'Salário', type: 'income' },
  { id: 'seed-cat-expense-1', userId: null, name: 'Alimentação', type: 'expense' },
]

type MockImportBatch = {
  id: string
  format: 'ofx' | 'csv' | 'pdf_invoice'
  accountId: string | null
  cardId: string | null
  mode: 'staged' | 'direct'
  status: 'processando' | 'aguardando_revisao' | 'concluido' | 'falhou'
  errorMessage: string | null
  createdAt: string
  processedAt: string | null
  contentText: string
}
type MockImportedRow = {
  id: string
  importBatchId: string
  date: string
  description: string
  amount: string
  type: 'income' | 'expense'
  externalId: string | null
  isDuplicateSuspect: boolean
  duplicateOfTransactionId: string | null
  suggestedCategoryId: string | null
  resolution: 'pendente' | 'aceita' | 'descartada'
  createdTransactionId: string | null
}

let banks: MockBank[] = []
let categories: MockCategory[] = []
let accounts: MockAccount[] = []
let cards: MockCard[] = []
let transactions: MockTransaction[] = []
let invoices: MockInvoice[] = []
let payableGroups: MockPayableGroup[] = []
let payables: MockPayable[] = []
let importBatches: MockImportBatch[] = []
let importedRows: MockImportedRow[] = []
let nextId = 1

export function resetMockData() {
  banks = DEFAULT_BANKS.map((b) => ({ ...b }))
  categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }))
  accounts = []
  cards = []
  transactions = []
  invoices = []
  payableGroups = []
  payables = []
  importBatches = []
  importedRows = []
  nextId = 1
}
resetMockData()

function normalizeDescriptionForMock(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function toPublicImportBatch(batch: MockImportBatch) {
  const { contentText: _contentText, ...publicFields } = batch
  return publicFields
}

/** Parses `date,description,amount,type` lines — stands in for the real OFX/LLM extractors. */
function parseMockImportRows(
  text: string
): Array<{ date: string; description: string; amount: string; type: 'income' | 'expense' }> | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return null

  const rows: Array<{ date: string; description: string; amount: string; type: 'income' | 'expense' }> = []
  for (const line of lines) {
    const [date, description, amount, type] = line.split(',').map((part) => part.trim())
    if (!date || !description || !amount || (type !== 'income' && type !== 'expense')) return null
    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) return null
    rows.push({ date, description, amount: amountValue.toFixed(2), type })
  }
  return rows
}

function processMockImportBatch(batch: MockImportBatch) {
  const rows = parseMockImportRows(batch.contentText)
  if (!rows) {
    batch.status = 'falhou'
    batch.errorMessage = 'Não foi possível processar o arquivo. Tente exportar em outro formato.'
    batch.processedAt = new Date().toISOString()
    return
  }

  let anyPending = false
  for (const row of rows) {
    const suspect = transactions.find(
      (t) =>
        (batch.accountId ? t.accountId === batch.accountId : t.cardId === batch.cardId) &&
        t.date.slice(0, 10) === row.date &&
        t.amount === row.amount &&
        t.type === row.type
    )
    const normalized = normalizeDescriptionForMock(row.description)
    const suggested = transactions.find(
      (t) => t.categoryId && normalizeDescriptionForMock(t.description) === normalized
    )

    const importedRow: MockImportedRow = {
      id: `imported-row-${nextId++}`,
      importBatchId: batch.id,
      date: row.date,
      description: row.description,
      amount: row.amount,
      type: row.type,
      externalId: null,
      isDuplicateSuspect: Boolean(suspect),
      duplicateOfTransactionId: suspect?.id ?? null,
      suggestedCategoryId: suggested?.categoryId ?? null,
      resolution: 'pendente',
      createdTransactionId: null,
    }
    importedRows.push(importedRow)

    if (batch.mode === 'direct' && !suspect) {
      const invoice = batch.cardId ? findOrCreateInvoice(batch.cardId, row.date) : null
      const transaction: MockTransaction = {
        id: `txn-${nextId++}`,
        type: row.type,
        amount: row.amount,
        date: row.date,
        description: row.description,
        categoryId: importedRow.suggestedCategoryId,
        accountId: batch.accountId,
        cardId: batch.cardId,
        refundOfTransactionId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentCount: null,
        invoiceId: invoice?.id ?? null,
      }
      transactions.push(transaction)
      importedRow.resolution = 'aceita'
      importedRow.createdTransactionId = transaction.id
    } else {
      anyPending = true
    }
  }

  batch.status = anyPending ? 'aguardando_revisao' : 'concluido'
  batch.processedAt = new Date().toISOString()
}

function dayInMonth(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clamped = Math.min(day, lastDay)
  return new Date(Date.UTC(year, month - 1, clamped)).toISOString().slice(0, 10)
}

function generateDueDates(startDate: string, dueDay: number, count: number): string[] {
  const [year, month] = startDate.slice(0, 7).split('-').map(Number)
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    dates.push(dayInMonth(year!, month! + i, dueDay))
  }
  return dates
}

function computePayableStatus(payable: MockPayable): PayableStatus {
  if (payable.cancelledAt) return 'cancelada'
  if (payable.paidTransactionId) return 'paga'
  const today = new Date().toISOString().slice(0, 10)
  if (payable.dueDate < today) return 'atrasada'
  if (payable.dueDate === today) return 'vence_hoje'
  return 'pendente'
}

function serializePayable(payable: MockPayable) {
  return { ...payable, status: computePayableStatus(payable) }
}

function computeProjectedAdjustment(accountId: string, date: string): number {
  return payables
    .filter(
      (p) => p.accountId === accountId && !p.cancelledAt && !p.paidTransactionId && p.dueDate <= date
    )
    .reduce((acc, p) => acc + (p.type === 'income' ? Number(p.amount) : -Number(p.amount)), 0)
}

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
      visible.map((a) => {
        const currentBalance = computeAccountBalance(a, date)
        const projectedBalance = Number(currentBalance) + computeProjectedAdjustment(a.id, date)
        return { ...a, currentBalance, projectedBalance: projectedBalance.toString() }
      })
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

  http.post(`${BASE_URL}/payable-groups`, async ({ request }) => {
    const body = (await request.json()) as {
      type: 'income' | 'expense'
      recurrenceType: 'installment' | 'recurring'
      amount: number
      dueDay: number
      startDate: string
      installmentCount?: number
      description?: string
      counterparty?: string
      accountId?: string
    }

    const group: MockPayableGroup = {
      id: `payable-group-${nextId++}`,
      type: body.type,
      recurrenceType: body.recurrenceType,
      installmentCount: body.recurrenceType === 'installment' ? (body.installmentCount ?? null) : null,
      amount: body.amount.toString(),
      dueDay: body.dueDay,
      description: body.description ?? null,
      counterparty: body.counterparty ?? null,
      accountId: body.accountId ?? null,
    }
    payableGroups.push(group)

    const count = body.recurrenceType === 'installment' ? (body.installmentCount ?? 2) : 6
    const dueDates = generateDueDates(body.startDate, body.dueDay, count)
    dueDates.forEach((dueDate, index) => {
      payables.push({
        id: `payable-${nextId++}`,
        groupId: group.id,
        type: group.type,
        amount: group.amount,
        dueDate,
        installmentNumber: index + 1,
        description: group.description,
        counterparty: group.counterparty,
        accountId: group.accountId,
        paidAmount: null,
        paidTransactionId: null,
        paidAt: null,
        cancelledAt: null,
        cancellationReason: null,
      })
    })

    return HttpResponse.json(group, { status: 201 })
  }),

  http.get(`${BASE_URL}/payable-groups`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const filtered = type ? payableGroups.filter((g) => g.type === type) : payableGroups
    return HttpResponse.json(
      filtered.map((group) => {
        const groupPayables = payables.filter((p) => p.groupId === group.id && !p.cancelledAt)
        const next = groupPayables
          .filter((p) => !p.paidTransactionId)
          .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]
        return { ...group, payableCount: groupPayables.length, nextDueDate: next?.dueDate ?? null }
      })
    )
  }),

  http.get(`${BASE_URL}/payable-groups/:id`, ({ params }) => {
    const group = payableGroups.find((g) => g.id === params.id)
    if (!group) return HttpResponse.json({ error: 'Payable group not found' }, { status: 404 })
    const groupPayables = payables
      .filter((p) => p.groupId === group.id)
      .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))
      .map(serializePayable)
    return HttpResponse.json({ ...group, payables: groupPayables })
  }),

  http.patch(`${BASE_URL}/payable-groups/:id`, async ({ request, params }) => {
    const group = payableGroups.find((g) => g.id === params.id)
    if (!group) return HttpResponse.json({ error: 'Payable group not found' }, { status: 404 })

    const body = (await request.json()) as {
      amount?: number
      dueDay?: number
      description?: string | null
      counterparty?: string | null
      accountId?: string | null
    }
    if (body.amount !== undefined) group.amount = body.amount.toString()
    if (body.dueDay !== undefined) group.dueDay = body.dueDay
    if (body.description !== undefined) group.description = body.description
    if (body.counterparty !== undefined) group.counterparty = body.counterparty
    if (body.accountId !== undefined) group.accountId = body.accountId

    for (const payable of payables) {
      if (payable.groupId !== group.id || payable.paidTransactionId || payable.cancelledAt) continue
      if (body.amount !== undefined) payable.amount = group.amount
      if (body.dueDay !== undefined) {
        const [year, month] = payable.dueDate.slice(0, 7).split('-').map(Number)
        payable.dueDate = dayInMonth(year!, month!, body.dueDay)
      }
      if (body.description !== undefined) payable.description = group.description
      if (body.counterparty !== undefined) payable.counterparty = group.counterparty
      if (body.accountId !== undefined) payable.accountId = group.accountId
    }

    return HttpResponse.json(group)
  }),

  http.delete(`${BASE_URL}/payable-groups/:id`, async ({ request, params }) => {
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') ?? 'pending'
    const group = payableGroups.find((g) => g.id === params.id)
    if (!group) return HttpResponse.json({ error: 'Payable group not found' }, { status: 404 })

    if (scope === 'pending') {
      payables = payables.filter((p) => !(p.groupId === group.id && !p.paidTransactionId && !p.cancelledAt))
      return new HttpResponse(null, { status: 204 })
    }

    const body = (await request.json()) as { confirmDeleteTransactions?: boolean }
    const groupPayables = payables.filter((p) => p.groupId === group.id)
    const paidCount = groupPayables.filter((p) => p.paidTransactionId).length
    if (paidCount > 0 && !body.confirmDeleteTransactions) {
      return HttpResponse.json(
        { error: 'This group has paid payables; confirm to also delete their linked transactions', deletePaidCount: paidCount },
        { status: 409 }
      )
    }

    const paidTransactionIds = groupPayables.map((p) => p.paidTransactionId).filter((id): id is string => id !== null)
    payables = payables.filter((p) => p.groupId !== group.id)
    transactions = transactions.filter((t) => !paidTransactionIds.includes(t.id))
    payableGroups = payableGroups.filter((g) => g.id !== group.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE_URL}/payables`, async ({ request }) => {
    const body = (await request.json()) as {
      type: 'income' | 'expense'
      amount: number
      dueDate: string
      description?: string
      counterparty?: string
      accountId?: string
    }
    const payable: MockPayable = {
      id: `payable-${nextId++}`,
      groupId: null,
      type: body.type,
      amount: body.amount.toString(),
      dueDate: body.dueDate,
      installmentNumber: null,
      description: body.description ?? null,
      counterparty: body.counterparty ?? null,
      accountId: body.accountId ?? null,
      paidAmount: null,
      paidTransactionId: null,
      paidAt: null,
      cancelledAt: null,
      cancellationReason: null,
    }
    payables.push(payable)
    return HttpResponse.json(serializePayable(payable), { status: 201 })
  }),

  http.get(`${BASE_URL}/payables/summary`, ({ request }) => {
    const url = new URL(request.url)
    const until = url.searchParams.get('until') ?? new Date().toISOString().slice(0, 10)
    const relevant = payables.filter((p) => !p.cancelledAt && !p.paidTransactionId && p.dueDate <= until)
    const totalPayable = relevant
      .filter((p) => p.type === 'expense')
      .reduce((acc, p) => acc + Number(p.amount), 0)
    const totalReceivable = relevant
      .filter((p) => p.type === 'income')
      .reduce((acc, p) => acc + Number(p.amount), 0)
    return HttpResponse.json({ totalPayable: totalPayable.toString(), totalReceivable: totalReceivable.toString() })
  }),

  http.get(`${BASE_URL}/payables`, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status') as PayableStatus | null
    const until = url.searchParams.get('until')
    const groupId = url.searchParams.get('groupId')
    const accountId = url.searchParams.get('accountId')

    let filtered = payables
    if (type) filtered = filtered.filter((p) => p.type === type)
    if (until) filtered = filtered.filter((p) => p.dueDate <= until)
    if (groupId) filtered = filtered.filter((p) => p.groupId === groupId)
    if (accountId) filtered = filtered.filter((p) => p.accountId === accountId)

    let withStatus = filtered.map(serializePayable)
    if (status) withStatus = withStatus.filter((p) => p.status === status)

    const sorted = [...withStatus].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    return HttpResponse.json({ items: sorted, nextCursor: null })
  }),

  http.get(`${BASE_URL}/payables/:id`, ({ params }) => {
    const payable = payables.find((p) => p.id === params.id)
    if (!payable) return HttpResponse.json({ error: 'Payable not found' }, { status: 404 })
    return HttpResponse.json(serializePayable(payable))
  }),

  http.patch(`${BASE_URL}/payables/:id`, async ({ request, params }) => {
    const payable = payables.find((p) => p.id === params.id)
    if (!payable) return HttpResponse.json({ error: 'Payable not found' }, { status: 404 })

    const status = computePayableStatus(payable)
    if (status === 'paga' || status === 'cancelada') {
      return HttpResponse.json({ error: 'Payable cannot be edited once paid or cancelled' }, { status: 409 })
    }

    const body = (await request.json()) as {
      amount?: number
      dueDate?: string
      description?: string | null
      counterparty?: string | null
      accountId?: string | null
    }
    if (body.amount !== undefined) payable.amount = body.amount.toString()
    if (body.dueDate !== undefined) payable.dueDate = body.dueDate
    if (body.description !== undefined) payable.description = body.description
    if (body.counterparty !== undefined) payable.counterparty = body.counterparty
    if (body.accountId !== undefined) payable.accountId = body.accountId

    return HttpResponse.json(serializePayable(payable))
  }),

  http.post(`${BASE_URL}/payables/:id/pay`, async ({ request, params }) => {
    const payable = payables.find((p) => p.id === params.id)
    if (!payable) return HttpResponse.json({ error: 'Payable not found' }, { status: 404 })

    const status = computePayableStatus(payable)
    if (status === 'paga') return HttpResponse.json({ error: 'Payable is already paid' }, { status: 409 })
    if (status === 'cancelada') return HttpResponse.json({ error: 'Payable is already cancelled' }, { status: 409 })

    const body = (await request.json()) as { accountId: string; paidAmount?: number; date?: string }
    const account = accounts.find((a) => a.id === body.accountId)
    if (!account) return HttpResponse.json({ error: 'Account not found' }, { status: 400 })

    const paidAmount = body.paidAmount ?? Number(payable.amount)
    const date = body.date ?? new Date().toISOString().slice(0, 10)
    const paymentTransaction: MockTransaction = {
      id: `txn-${nextId++}`,
      type: payable.type,
      amount: paidAmount.toFixed(2),
      date,
      description: payable.description ?? 'Conta a pagar/receber',
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

    payable.paidAmount = paidAmount.toString()
    payable.paidTransactionId = paymentTransaction.id
    payable.paidAt = new Date().toISOString()

    return HttpResponse.json(serializePayable(payable))
  }),

  http.post(`${BASE_URL}/payables/:id/cancel`, async ({ request, params }) => {
    const payable = payables.find((p) => p.id === params.id)
    if (!payable) return HttpResponse.json({ error: 'Payable not found' }, { status: 404 })

    const status = computePayableStatus(payable)
    if (status === 'cancelada') {
      return HttpResponse.json({ error: 'Payable is already cancelled' }, { status: 409 })
    }

    const body = (await request.json()) as { cancellationReason?: string; confirmDeleteTransaction?: boolean }

    if (status === 'paga') {
      if (!body.confirmDeleteTransaction) {
        const transaction = transactions.find((t) => t.id === payable.paidTransactionId)!
        return HttpResponse.json(
          {
            error: 'This payable is already paid; confirm to also delete its linked transaction',
            deleteTransaction: {
              id: transaction.id,
              amount: transaction.amount,
              date: transaction.date,
              accountId: transaction.accountId,
            },
          },
          { status: 409 }
        )
      }
      transactions = transactions.filter((t) => t.id !== payable.paidTransactionId)
      payable.paidTransactionId = null
      payable.paidAt = null
      payable.paidAmount = null
    }

    payable.cancelledAt = new Date().toISOString()
    payable.cancellationReason = body.cancellationReason ?? null

    return HttpResponse.json(serializePayable(payable))
  }),

  http.delete(`${BASE_URL}/payables/:id`, async ({ request, params }) => {
    const payable = payables.find((p) => p.id === params.id)
    if (!payable) return HttpResponse.json({ error: 'Payable not found' }, { status: 404 })

    if (payable.paidTransactionId) {
      const body = (await request.json()) as { confirmDeleteTransaction?: boolean }
      if (!body.confirmDeleteTransaction) {
        const transaction = transactions.find((t) => t.id === payable.paidTransactionId)!
        return HttpResponse.json(
          {
            error: 'This payable is already paid; confirm to also delete its linked transaction',
            deleteTransaction: {
              id: transaction.id,
              amount: transaction.amount,
              date: transaction.date,
              accountId: transaction.accountId,
            },
          },
          { status: 409 }
        )
      }
      transactions = transactions.filter((t) => t.id !== payable.paidTransactionId)
    }

    payables = payables.filter((p) => p.id !== payable.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE_URL}/import-batches`, async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return HttpResponse.json({ error: 'A file is required' }, { status: 400 })

    const format = formData.get('format') as MockImportBatch['format']
    const mode = formData.get('mode') as MockImportBatch['mode']
    const accountId = (formData.get('accountId') as string | null) || null
    const cardId = (formData.get('cardId') as string | null) || null
    const confirmDuplicateFile = formData.get('confirmDuplicateFile') === 'true'
    const contentText = await file.text()

    if (!confirmDuplicateFile) {
      const previous = importBatches.find((b) => b.contentText === contentText && b.status === 'concluido')
      if (previous) {
        return HttpResponse.json(
          {
            error: 'An identical file was already imported successfully; confirm to import it again',
            previousImportBatchId: previous.id,
            previousImportedAt: previous.processedAt,
          },
          { status: 409 }
        )
      }
    }

    const batch: MockImportBatch = {
      id: `import-${nextId++}`,
      format,
      accountId,
      cardId,
      mode,
      status: 'processando',
      errorMessage: null,
      createdAt: new Date().toISOString(),
      processedAt: null,
      contentText,
    }
    importBatches.push(batch)
    processMockImportBatch(batch)

    return HttpResponse.json(toPublicImportBatch(batch), { status: 202 })
  }),

  http.get(`${BASE_URL}/import-batches`, () => {
    const sorted = [...importBatches].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return HttpResponse.json(sorted.map(toPublicImportBatch))
  }),

  http.get(`${BASE_URL}/import-batches/:id`, ({ params }) => {
    const batch = importBatches.find((b) => b.id === params.id)
    if (!batch) return HttpResponse.json({ error: 'Import batch not found' }, { status: 404 })
    return HttpResponse.json(toPublicImportBatch(batch))
  }),

  http.get(`${BASE_URL}/import-batches/:id/rows`, ({ params }) => {
    const batch = importBatches.find((b) => b.id === params.id)
    if (!batch) return HttpResponse.json({ error: 'Import batch not found' }, { status: 404 })
    return HttpResponse.json(importedRows.filter((r) => r.importBatchId === batch.id))
  }),

  http.post(`${BASE_URL}/import-batches/:id/confirm`, ({ params }) => {
    const batch = importBatches.find((b) => b.id === params.id)
    if (!batch) return HttpResponse.json({ error: 'Import batch not found' }, { status: 404 })
    if (batch.status !== 'aguardando_revisao') {
      return HttpResponse.json({ error: 'Import batch is not awaiting review' }, { status: 409 })
    }

    const pending = importedRows.filter((r) => r.importBatchId === batch.id && r.resolution === 'pendente')
    for (const row of pending) {
      const invoice = batch.cardId ? findOrCreateInvoice(batch.cardId, row.date) : null
      const transaction: MockTransaction = {
        id: `txn-${nextId++}`,
        type: row.type,
        amount: row.amount,
        date: row.date,
        description: row.description,
        categoryId: row.suggestedCategoryId,
        accountId: batch.accountId,
        cardId: batch.cardId,
        refundOfTransactionId: null,
        installmentGroupId: null,
        installmentNumber: null,
        installmentCount: null,
        invoiceId: invoice?.id ?? null,
      }
      transactions.push(transaction)
      row.resolution = 'aceita'
      row.createdTransactionId = transaction.id
    }

    batch.status = 'concluido'
    batch.processedAt = new Date().toISOString()
    return HttpResponse.json(toPublicImportBatch(batch))
  }),

  http.patch(`${BASE_URL}/imported-rows/:id`, async ({ request, params }) => {
    const row = importedRows.find((r) => r.id === params.id)
    if (!row) return HttpResponse.json({ error: 'Imported row not found' }, { status: 404 })
    if (row.resolution !== 'pendente') {
      return HttpResponse.json({ error: 'Imported row is not pending review' }, { status: 409 })
    }

    const body = (await request.json()) as {
      date?: string
      description?: string
      amount?: number
      type?: 'income' | 'expense'
      categoryId?: string | null
    }
    if (body.date !== undefined) row.date = body.date
    if (body.description !== undefined) row.description = body.description
    if (body.amount !== undefined) row.amount = body.amount.toFixed(2)
    if (body.type !== undefined) row.type = body.type
    if (body.categoryId !== undefined) row.suggestedCategoryId = body.categoryId

    return HttpResponse.json(row)
  }),

  http.post(`${BASE_URL}/imported-rows/:id/discard`, ({ params }) => {
    const row = importedRows.find((r) => r.id === params.id)
    if (!row) return HttpResponse.json({ error: 'Imported row not found' }, { status: 404 })
    if (row.resolution !== 'pendente') {
      return HttpResponse.json({ error: 'Imported row is not pending review' }, { status: 409 })
    }

    row.resolution = 'descartada'
    return HttpResponse.json(row)
  }),
]
