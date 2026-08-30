import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

/** multipart/form-data fields always arrive as strings — this coerces "true"/"false" properly, unlike z.coerce.boolean() (which treats any non-empty string, including "false", as true). */
const booleanFormField = z.preprocess((value) => {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  return value === 'true'
}, z.boolean().optional())

export const uploadImportBatchSchema = z
  .object({
    format: z.enum(['ofx', 'csv', 'pdf_invoice']),
    accountId: z.string().trim().min(1).optional(),
    cardId: z.string().trim().min(1).optional(),
    mode: z.enum(['staged', 'direct']),
    confirmDuplicateFile: booleanFormField,
  })
  .refine((data) => Boolean(data.accountId) !== Boolean(data.cardId), {
    message: 'Exactly one of accountId or cardId is required',
    path: ['accountId'],
  })
  .refine((data) => (data.format === 'pdf_invoice') === Boolean(data.cardId), {
    message: 'pdf_invoice requires cardId as destination; ofx/csv require accountId',
    path: ['format'],
  })

export const updateImportedRowSchema = z.object({
  date: dateOnly.optional(),
  description: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(['income', 'expense']).optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
})
