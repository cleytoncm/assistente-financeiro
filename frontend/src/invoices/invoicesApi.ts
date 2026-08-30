import { apiFetch } from '../lib/httpClient'
import type { Transaction } from '../transactions/transactionsApi'

export type InvoiceStatus = 'aberta' | 'fechada' | 'atrasada' | 'paga'

export type Invoice = {
  id: string
  cardId: string
  periodYear: number
  periodMonth: number
  closingDate: string
  dueDate: string
  paidAt: string | null
  paymentAccountId: string | null
  paymentTransactionId: string | null
  status: InvoiceStatus
  total: string
}

export function listInvoicesForCard(cardId: string): Promise<Invoice[]> {
  return apiFetch<Invoice[]>(`/cards/${cardId}/invoices`)
}

export function getInvoice(id: string): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}`)
}

export function getInvoiceTransactions(id: string): Promise<{ items: Transaction[]; total: number }> {
  return apiFetch(`/invoices/${id}/transactions`)
}

export function updateInvoice(
  id: string,
  data: { closingDate?: string; dueDate?: string }
): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: data })
}

export function payInvoice(id: string, data: { accountId: string }): Promise<Invoice> {
  return apiFetch<Invoice>(`/invoices/${id}/pay`, { method: 'POST', body: data })
}
