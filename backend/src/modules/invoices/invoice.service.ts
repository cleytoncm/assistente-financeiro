import { Prisma, type Invoice } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import { scopedToUser } from '../../lib/scopedToUser.js'
import { todayDateOnly } from '../../lib/dateOnly.js'
import { netAmount } from '../transactions/balanceMath.js'
import { computeInvoiceDates, nextPeriod, earlierPeriod, type InvoicePeriod } from './invoicePeriod.js'
import { computeInvoiceStatus, type InvoiceStatus } from './invoiceStatus.js'
import {
  InvalidInvoiceDatesError,
  InvoiceAlreadyPaidError,
  InvoiceNotFoundError,
  PaymentAccountNotFoundError,
} from './invoice.errors.js'

/** Finds the invoice covering `date` for this card, creating intermediate periods if needed (RF-01). */
export async function resolveInvoiceForDate(userId: string, cardId: string, date: Date): Promise<Invoice> {
  const existing = await prisma.invoice.findFirst({
    where: { cardId, closingDate: { gte: date } },
    orderBy: { closingDate: 'asc' },
  })
  if (existing) return existing

  const card = await prisma.card.findUniqueOrThrow({ where: { id: cardId } })
  const lastInvoice = await prisma.invoice.findFirst({
    where: { cardId },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  })

  const creationPeriod: InvoicePeriod = {
    periodYear: card.createdAt.getUTCFullYear(),
    periodMonth: card.createdAt.getUTCMonth() + 1,
  }
  const targetPeriod: InvoicePeriod = { periodYear: date.getUTCFullYear(), periodMonth: date.getUTCMonth() + 1 }

  let period: InvoicePeriod = lastInvoice ? nextPeriod(lastInvoice) : earlierPeriod(creationPeriod, targetPeriod)

  let created: Invoice
  for (;;) {
    const { closingDate, dueDate } = computeInvoiceDates(period, card.closingDay, card.dueDay)
    created = await prisma.invoice.create({
      data: { userId, cardId, periodYear: period.periodYear, periodMonth: period.periodMonth, closingDate, dueDate },
    })
    if (closingDate >= date) break
    period = nextPeriod(period)
  }
  return created
}

export async function computeInvoiceTotal(invoiceId: string): Promise<Prisma.Decimal> {
  const [expenseSum, incomeSum] = await Promise.all([
    prisma.transaction.aggregate({ where: { invoiceId, type: 'expense' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { invoiceId, type: 'income' }, _sum: { amount: true } }),
  ])
  return netAmount(0, expenseSum._sum.amount ?? 0, incomeSum._sum.amount ?? 0)
}

export type InvoiceWithStatus = Invoice & { status: InvoiceStatus; total: string }

async function attachStatusAndTotal(invoice: Invoice): Promise<InvoiceWithStatus> {
  const total = await computeInvoiceTotal(invoice.id)
  return { ...invoice, status: computeInvoiceStatus(invoice, todayDateOnly()), total: total.toString() }
}

export async function listInvoicesForCard(userId: string, cardId: string): Promise<InvoiceWithStatus[]> {
  const invoices = await prisma.invoice.findMany(
    scopedToUser(userId, { where: { cardId }, orderBy: [{ periodYear: 'asc' as const }, { periodMonth: 'asc' as const }] })
  )
  return Promise.all(invoices.map(attachStatusAndTotal))
}

export async function getOwnedInvoice(userId: string, id: string): Promise<Invoice> {
  const invoice = await prisma.invoice.findFirst(scopedToUser(userId, { where: { id } }))
  if (!invoice) throw new InvoiceNotFoundError()
  return invoice
}

export async function getInvoiceDetail(userId: string, id: string): Promise<InvoiceWithStatus> {
  const invoice = await getOwnedInvoice(userId, id)
  return attachStatusAndTotal(invoice)
}

export async function updateInvoiceDates(
  userId: string,
  id: string,
  params: { closingDate?: string; dueDate?: string }
): Promise<InvoiceWithStatus> {
  const invoice = await getOwnedInvoice(userId, id)
  if (invoice.paidAt !== null) throw new InvoiceAlreadyPaidError()

  const closingDate = params.closingDate ? new Date(`${params.closingDate}T00:00:00.000Z`) : invoice.closingDate
  const dueDate = params.dueDate ? new Date(`${params.dueDate}T00:00:00.000Z`) : invoice.dueDate
  if (closingDate >= dueDate) throw new InvalidInvoiceDatesError()

  const updated = await prisma.invoice.update({ where: { id }, data: { closingDate, dueDate } })
  return attachStatusAndTotal(updated)
}

/** Updates the invoice's payment Transaction to match its current total (RF-06 confirmation). */
export async function syncPaymentTransactionAmount(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  if (!invoice.paymentTransactionId) return
  const total = await computeInvoiceTotal(invoiceId)
  await prisma.transaction.update({ where: { id: invoice.paymentTransactionId }, data: { amount: total } })
}

export async function payInvoice(
  userId: string,
  id: string,
  params: { accountId: string }
): Promise<InvoiceWithStatus> {
  const invoice = await getOwnedInvoice(userId, id)
  if (invoice.paidAt !== null) throw new InvoiceAlreadyPaidError()

  const account = await prisma.account.findFirst(scopedToUser(userId, { where: { id: params.accountId } }))
  if (!account) throw new PaymentAccountNotFoundError()

  const total = await computeInvoiceTotal(id)

  const paymentTransaction = await prisma.transaction.create({
    data: {
      userId,
      type: 'expense',
      amount: total,
      date: todayDateOnly(),
      description: 'Pagamento de fatura',
      accountId: account.id,
    },
  })

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      paidAt: new Date(),
      paymentAccountId: account.id,
      paymentTransactionId: paymentTransaction.id,
    },
  })

  return attachStatusAndTotal(updated)
}
