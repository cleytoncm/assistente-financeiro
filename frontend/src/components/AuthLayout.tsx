import type { ReactNode } from 'react'
import { Card } from './ui/Card'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold text-slate-900 dark:text-slate-50">
          Assistente Financeiro
        </p>
        <Card>{children}</Card>
      </div>
    </main>
  )
}
