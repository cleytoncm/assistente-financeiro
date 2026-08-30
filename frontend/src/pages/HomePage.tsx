import { useEffect, useState } from 'react'
import { meRequest, type PublicUser } from '../auth/authApi'
import { Card } from '../components/ui/Card'

export function HomePage() {
  const [user, setUser] = useState<PublicUser | null>(null)

  useEffect(() => {
    meRequest().then(setUser).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1>Assistente Financeiro</h1>
        {user && (
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Olá, {user.name} ({user.email})
          </p>
        )}
      </div>

      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Use o menu no topo para gerenciar suas contas e cartões, registrar lançamentos,
          acompanhar contas a pagar/receber e importar extratos ou faturas.
        </p>
      </Card>
    </div>
  )
}
