import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { apiFetch, ApiError, setToken, getToken, UNAUTHORIZED_EVENT } from './httpClient'

describe('apiFetch', () => {
  it('sends the stored token in the Authorization header', async () => {
    setToken('my-token')
    const user = await apiFetch<{ id: string }>('/auth/me')
    expect(user.id).toBe('user-1')
  })

  it('throws ApiError, clears the token and dispatches the unauthorized event on a 401', async () => {
    server.use(
      http.get('http://localhost:3000/auth/me', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    )
    setToken('my-token')

    let dispatched = false
    const listener = () => {
      dispatched = true
    }
    window.addEventListener(UNAUTHORIZED_EVENT, listener)

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError)

    window.removeEventListener(UNAUTHORIZED_EVENT, listener)

    expect(getToken()).toBeNull()
    expect(dispatched).toBe(true)
  })

  it('rejects with the server error message on a non-2xx response', async () => {
    await expect(
      apiFetch('/auth/login', {
        method: 'POST',
        body: { email: 'a@b.com', password: 'wrongpassword' },
      })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })
  })
})
