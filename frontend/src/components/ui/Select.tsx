import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300',
        'focus:ring-2 focus:ring-inset focus:ring-indigo-600',
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
        'dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:focus:ring-indigo-500',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
