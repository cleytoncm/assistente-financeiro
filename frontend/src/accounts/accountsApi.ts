import { apiFetch } from '../lib/httpClient'
import type { Bank } from '../banks/banksApi'

export type Account = {
  id: string
  name: string
  bankId: string
  currency: string
  initialBalance: string
  isActive: boolean
  isHidden: boolean
  bank?: Bank
  currentBalance: string
  projectedBalance: string
}

export function listAccounts(options: { date?: string; includeHidden?: boolean } = {}): Promise<Account[]> {
  const params = new URLSearchParams()
  if (options.date) params.set('date', options.date)
  if (options.includeHidden) params.set('includeHidden', 'true')
  const query = params.toString()
  return apiFetch<Account[]>(`/accounts${query ? `?${query}` : ''}`)
}

export function createAccount(data: {
  name: string
  bankId: string
  currency?: string
  initialBalance: number
}): Promise<Account> {
  return apiFetch<Account>('/accounts', { method: 'POST', body: data })
}

export function updateAccount(
  id: string,
  data: { name?: string; bankId?: string; currency?: string }
): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}`, { method: 'PATCH', body: data })
}

export function updateAccountStatus(
  id: string,
  data: { isActive?: boolean; isHidden?: boolean }
): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/status`, { method: 'PATCH', body: data })
}

export function deleteAccount(id: string, cascade = false): Promise<void> {
  return apiFetch<void>(`/accounts/${id}${cascade ? '?cascade=true' : ''}`, { method: 'DELETE' })
}
