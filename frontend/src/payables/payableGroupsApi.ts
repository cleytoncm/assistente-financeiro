import { apiFetch } from '../lib/httpClient'
import type { Payable } from './payablesApi'

export type PayableGroup = {
  id: string
  type: 'income' | 'expense'
  recurrenceType: 'installment' | 'recurring'
  installmentCount: number | null
  amount: string
  dueDay: number
  description: string | null
  counterparty: string | null
  accountId: string | null
  payableCount: number
  nextDueDate: string | null
}

export type CreatePayableGroupInput = {
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

export function createPayableGroup(data: CreatePayableGroupInput): Promise<PayableGroup> {
  return apiFetch<PayableGroup>('/payable-groups', { method: 'POST', body: data })
}

export function listPayableGroups(filters: { type?: 'income' | 'expense' } = {}): Promise<PayableGroup[]> {
  const params = new URLSearchParams()
  if (filters.type) params.set('type', filters.type)
  const query = params.toString()
  return apiFetch<PayableGroup[]>(`/payable-groups${query ? `?${query}` : ''}`)
}

export type PayableGroupDetail = PayableGroup & { payables: Payable[] }

export function getPayableGroup(id: string): Promise<PayableGroupDetail> {
  return apiFetch<PayableGroupDetail>(`/payable-groups/${id}`)
}

export type UpdatePayableGroupInput = {
  amount?: number
  dueDay?: number
  description?: string | null
  counterparty?: string | null
  accountId?: string | null
}

export function updatePayableGroup(id: string, data: UpdatePayableGroupInput): Promise<PayableGroup> {
  return apiFetch<PayableGroup>(`/payable-groups/${id}`, { method: 'PATCH', body: data })
}

export function deletePayableGroup(
  id: string,
  scope: 'pending' | 'all',
  confirmDeleteTransactions?: boolean
): Promise<void> {
  return apiFetch<void>(`/payable-groups/${id}?scope=${scope}`, {
    method: 'DELETE',
    body: { confirmDeleteTransactions },
  })
}
