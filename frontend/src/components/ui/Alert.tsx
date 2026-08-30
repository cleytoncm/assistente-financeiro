import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Alert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200',
        'dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900',
        className
      )}
    >
      {children}
    </p>
  )
}

export function ConfirmPanel({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label': string
}) {
  return (
    <section
      role="alertdialog"
      aria-label={ariaLabel}
      className={cn(
        'space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900',
        'dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
        className
      )}
    >
      {children}
    </section>
  )
}
