import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../lib/cn'

const NAV_LINKS = [
  { to: '/', label: 'Início' },
  { to: '/contas', label: 'Contas e Cartões' },
  { to: '/lancamentos', label: 'Lançamentos' },
  { to: '/contas-a-pagar', label: 'Contas a Pagar/Receber' },
  { to: '/importacoes', label: 'Importações' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="text-base font-semibold text-slate-900 no-underline hover:text-slate-900 dark:text-slate-50 dark:hover:text-slate-50"
          >
            Assistente Financeiro
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = link.to === '/' ? pathname === '/' : pathname.startsWith(link.to)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium no-underline',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
