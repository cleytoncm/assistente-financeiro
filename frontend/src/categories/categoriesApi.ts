import { apiFetch } from '../lib/httpClient'

export type Category = {
  id: string
  userId: string | null
  name: string
  type: 'income' | 'expense'
}

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories')
}

export function createCategory(data: { name: string; type: 'income' | 'expense' }): Promise<Category> {
  return apiFetch<Category>('/categories', { method: 'POST', body: data })
}
