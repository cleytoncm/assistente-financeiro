import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const updateInvoiceSchema = z.object({
  closingDate: dateOnly.optional(),
  dueDate: dateOnly.optional(),
})

export const payInvoiceSchema = z.object({
  accountId: z.string().trim().min(1, 'accountId is required'),
})
