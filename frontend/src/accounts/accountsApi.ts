import { apiFetch } from '../lib/httpClient'
import type { Bank } from '../banks/banksApi'

export type Account = {
  id: string
  name: string
  bankId: string
  currency: string
  initialBalance: string
  bank?: Bank
}

export function listAccounts(): Promise<Account[]> {
  return apiFetch<Account[]>('/accounts')
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

export function deleteAccount(id: string): Promise<void> {
  return apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' })
}
