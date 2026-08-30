import { apiFetch } from '../lib/httpClient'

export type PayableStatus = 'pendente' | 'vence_hoje' | 'atrasada' | 'paga' | 'cancelada'

export type Payable = {
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
  status: PayableStatus
}

export type CreatePayableInput = {
  type: 'income' | 'expense'
  amount: number
  dueDate: string
  description?: string
  counterparty?: string
  accountId?: string
}

export function createPayable(data: CreatePayableInput): Promise<Payable> {
  return apiFetch<Payable>('/payables', { method: 'POST', body: data })
}

export type ListPayablesFilters = {
  type?: 'income' | 'expense'
  status?: PayableStatus
  until?: string
  groupId?: string
  accountId?: string
  limit?: number
  cursor?: string
}

export function listPayables(
  filters: ListPayablesFilters = {}
): Promise<{ items: Payable[]; nextCursor: string | null }> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const query = params.toString()
  return apiFetch(`/payables${query ? `?${query}` : ''}`)
}

export function getPayable(id: string): Promise<Payable> {
  return apiFetch<Payable>(`/payables/${id}`)
}

export type UpdatePayableInput = {
  amount?: number
  dueDate?: string
  description?: string | null
  counterparty?: string | null
  accountId?: string | null
}

export function updatePayable(id: string, data: UpdatePayableInput): Promise<Payable> {
  return apiFetch<Payable>(`/payables/${id}`, { method: 'PATCH', body: data })
}

export function payPayable(
  id: string,
  data: { accountId: string; paidAmount?: number; date?: string }
): Promise<Payable> {
  return apiFetch<Payable>(`/payables/${id}/pay`, { method: 'POST', body: data })
}

export function cancelPayable(
  id: string,
  data: { cancellationReason?: string; confirmDeleteTransaction?: boolean }
): Promise<Payable> {
  return apiFetch<Payable>(`/payables/${id}/cancel`, { method: 'POST', body: data })
}

export function deletePayable(id: string, confirmDeleteTransaction?: boolean): Promise<void> {
  return apiFetch<void>(`/payables/${id}`, { method: 'DELETE', body: { confirmDeleteTransaction } })
}

export function getPayablesSummary(until: string): Promise<{ totalPayable: string; totalReceivable: string }> {
  return apiFetch(`/payables/summary?until=${until}`)
}
