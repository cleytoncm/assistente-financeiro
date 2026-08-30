import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getToken, setToken as persistToken, clearToken, UNAUTHORIZED_EVENT } from '../lib/httpClient'

type AuthContextValue = {
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getToken() !== null)

  function login(token: string) {
    persistToken(token)
    setIsAuthenticated(true)
  }

  function logout() {
    clearToken()
    setIsAuthenticated(false)
  }

  // Reacts to httpClient's global 401 handling (any API call that comes back unauthorized
  // clears the token there); this keeps context state in sync so RequireAuth redirects.
  useEffect(() => {
    function handleUnauthorized() {
      setIsAuthenticated(false)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
