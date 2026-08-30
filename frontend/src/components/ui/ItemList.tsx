import type { HTMLAttributes, LiHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function ItemList({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white',
        'dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      {...props}
    />
  )
}

export function ItemRow({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3', className)}
      {...props}
    />
  )
}
