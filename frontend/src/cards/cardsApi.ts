import { apiFetch } from '../lib/httpClient'
import type { Account } from '../accounts/accountsApi'

export type Card = {
  id: string
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  linkedAccountId: string | null
  linkedAccount?: Account | null
}

export function listCards(): Promise<Card[]> {
  return apiFetch<Card[]>('/cards')
}

export function createCard(data: {
  name: string
  creditLimit: number
  closingDay: number
  dueDay: number
  linkedAccountId?: string
}): Promise<Card> {
  return apiFetch<Card>('/cards', { method: 'POST', body: data })
}

export function updateCard(
  id: string,
  data: {
    name?: string
    creditLimit?: number
    closingDay?: number
    dueDay?: number
    linkedAccountId?: string | null
  }
): Promise<Card> {
  return apiFetch<Card>(`/cards/${id}`, { method: 'PATCH', body: data })
}

export function deleteCard(id: string): Promise<void> {
  return apiFetch<void>(`/cards/${id}`, { method: 'DELETE' })
}
