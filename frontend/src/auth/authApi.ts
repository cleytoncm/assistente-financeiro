import { apiFetch } from '../lib/httpClient'

export type PublicUser = {
  id: string
  name: string
  email: string
}

export function registerRequest(data: {
  name: string
  email: string
  password: string
}): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/register', { method: 'POST', body: data })
}

export function loginRequest(data: { email: string; password: string }): Promise<{ token: string }> {
  return apiFetch<{ token: string }>('/auth/login', { method: 'POST', body: data })
}

export function meRequest(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/me')
}
