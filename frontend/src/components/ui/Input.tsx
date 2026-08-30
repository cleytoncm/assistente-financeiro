import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300',
        'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600',
        'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
        'dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:focus:ring-indigo-500 dark:disabled:bg-slate-900',
        className
      )}
      {...props}
    />
  )
}
