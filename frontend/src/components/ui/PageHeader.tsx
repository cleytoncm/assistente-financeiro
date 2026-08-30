import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function PageHeader({
  backTo,
  backLabel = 'Voltar',
  title,
  actions,
}: {
  backTo?: string
  backLabel?: string
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link
          to={backTo}
          className="mb-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
