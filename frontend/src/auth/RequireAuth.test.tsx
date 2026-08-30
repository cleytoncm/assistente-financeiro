import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { RequireAuth } from './RequireAuth'
import { UNAUTHORIZED_EVENT, setToken } from '../lib/httpClient'

function renderProtectedApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <div>Conteúdo protegido</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Tela de login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('RequireAuth', () => {
  it('redirects to /login when there is no token', () => {
    renderProtectedApp()
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('renders the protected content when a token is present', () => {
    setToken('some-token')
    renderProtectedApp()
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('redirects to /login after a global 401 clears the session', () => {
    setToken('some-token')
    renderProtectedApp()
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    })

    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })
})
