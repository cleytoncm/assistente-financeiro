import { apiFetch } from '../lib/httpClient'

export type Bank = {
  id: string
  name: string
  code: string
}

export function listBanks(): Promise<Bank[]> {
  return apiFetch<Bank[]>('/banks')
}

export function createBank(data: { name: string; code: string }): Promise<Bank> {
  return apiFetch<Bank>('/banks', { method: 'POST', body: data })
}
