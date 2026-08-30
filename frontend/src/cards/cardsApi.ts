import { apiFetch } from '../lib/httpClient'
import type { Account } from '../accounts/accountsApi'

export type Card = {
  id: string
  name: string
  creditLimit: string
  closingDay: number
  dueDay: number
  linkedAccountId: string | null
  isActive: boolean
  isHidden: boolean
  linkedAccount?: Account | null
  currentSpending: string
  availableLimit: string
}

export function listCards(options: { date?: string; includeHidden?: boolean } = {}): Promise<Card[]> {
  const params = new URLSearchParams()
  if (options.date) params.set('date', options.date)
  if (options.includeHidden) params.set('includeHidden', 'true')
  const query = params.toString()
  return apiFetch<Card[]>(`/cards${query ? `?${query}` : ''}`)
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

export function updateCardStatus(
  id: string,
  data: { isActive?: boolean; isHidden?: boolean }
): Promise<Card> {
  return apiFetch<Card>(`/cards/${id}/status`, { method: 'PATCH', body: data })
}

export function deleteCard(id: string, cascade = false): Promise<void> {
  return apiFetch<void>(`/cards/${id}${cascade ? '?cascade=true' : ''}`, { method: 'DELETE' })
}
