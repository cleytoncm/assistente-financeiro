import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginRequest } from '../auth/authApi'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/httpClient'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const justRegistered = Boolean((location.state as { registered?: boolean } | null)?.registered)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const { token } = await loginRequest({ email, password })
      login(token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? 'E-mail ou senha inválidos.' : 'Erro ao entrar. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Entrar</h1>
      {justRegistered && <p>Conta criada com sucesso. Faça login para continuar.</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p>
        Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
      </p>
    </main>
  )
}
