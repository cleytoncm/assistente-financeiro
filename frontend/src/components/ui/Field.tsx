import type { ReactNode } from 'react'
import { Label } from './Label'

export function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode
  htmlFor: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
