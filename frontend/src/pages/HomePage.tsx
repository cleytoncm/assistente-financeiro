import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { meRequest, type PublicUser } from '../auth/authApi'
import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { logout } = useAuth()
  const [user, setUser] = useState<PublicUser | null>(null)

  useEffect(() => {
    meRequest().then(setUser).catch(() => {})
  }, [])

  return (
    <main>
      <h1>Assistente Financeiro</h1>
      {user && (
        <p>
          Olá, {user.name} ({user.email})
        </p>
      )}
      <p>
        <Link to="/contas">Contas e Cartões</Link>
      </p>
      <p>
        <Link to="/lancamentos">Lançamentos</Link>
      </p>
      <button type="button" onClick={logout}>
        Sair
      </button>
    </main>
  )
}
