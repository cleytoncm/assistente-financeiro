import { apiFetch } from '../lib/httpClient'

export type Transaction = {
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

export type CreateTransactionInput = {
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

export type InvoicePaymentAdjustment = { invoiceId: string; oldAmount: string; newAmount: string }

export function createTransaction(data: CreateTransactionInput): Promise<Transaction | Transaction[]> {
  return apiFetch('/transactions', { method: 'POST', body: data })
}

export type ListTransactionsFilters = {
  accountId?: string
  cardId?: string
  categoryId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export function listTransactions(
  filters: ListTransactionsFilters = {}
): Promise<{ items: Transaction[]; total: number }> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const query = params.toString()
  return apiFetch(`/transactions${query ? `?${query}` : ''}`)
}

export type UpdateTransactionInput = {
  type?: 'income' | 'expense'
  amount?: number
  date?: string
  description?: string
  categoryId?: string | null
  accountId?: string
  cardId?: string
  confirmPaymentAdjustment?: boolean
}

export function updateTransaction(
  id: string,
  data: UpdateTransactionInput,
  applyToRemaining = false
): Promise<Transaction> {
  return apiFetch(`/transactions/${id}${applyToRemaining ? '?applyToRemaining=true' : ''}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteTransaction(id: string, scope: 'single' | 'remaining' = 'single'): Promise<void> {
  return apiFetch(`/transactions/${id}?scope=${scope}`, { method: 'DELETE' })
}
