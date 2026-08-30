import { z } from 'zod'

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const createTransactionSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive('Amount must be positive'),
    date: dateOnly,
    description: z.string().trim().min(1, 'Description is required'),
    categoryId: z.string().trim().min(1).optional(),
    accountId: z.string().trim().min(1).optional(),
    cardId: z.string().trim().min(1).optional(),
    refundOfTransactionId: z.string().trim().min(1).optional(),
    installments: z.number().int().min(2).optional(),
    confirmPaymentAdjustment: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.accountId) !== Boolean(data.cardId), {
    message: 'Exactly one of accountId or cardId is required',
    path: ['accountId'],
  })
  .refine((data) => !data.installments || data.cardId, {
    message: 'installments is only allowed for card transactions',
    path: ['installments'],
  })

export const updateTransactionSchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  amount: z.number().positive().optional(),
  date: dateOnly.optional(),
  description: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  accountId: z.string().trim().min(1).optional(),
  cardId: z.string().trim().min(1).optional(),
  confirmPaymentAdjustment: z.boolean().optional(),
})

export const listTransactionsQuerySchema = z.object({
  accountId: z.string().trim().min(1).optional(),
  cardId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})
