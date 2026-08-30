import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

export const createPayableGroupSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    recurrenceType: z.enum(['installment', 'recurring']),
    amount: z.number().positive('Amount must be positive'),
    dueDay: z.number().int().min(1).max(31),
    startDate: dateOnly,
    installmentCount: z.number().int().min(2).optional(),
    description: z.string().trim().min(1).optional(),
    counterparty: z.string().trim().min(1).optional(),
    accountId: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.recurrenceType !== 'installment' || data.installmentCount !== undefined, {
    message: 'installmentCount is required when recurrenceType is installment',
    path: ['installmentCount'],
  })
  .refine((data) => data.recurrenceType !== 'recurring' || data.installmentCount === undefined, {
    message: 'installmentCount must be omitted when recurrenceType is recurring',
    path: ['installmentCount'],
  })

export const updatePayableGroupSchema = z.object({
  amount: z.number().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  counterparty: z.string().trim().min(1).nullable().optional(),
  accountId: z.string().trim().min(1).nullable().optional(),
})

export const listPayableGroupsQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
})

export const deletePayableGroupQuerySchema = z.object({
  scope: z.enum(['pending', 'all']),
})

export const deletePayableGroupBodySchema = z.object({
  confirmDeleteTransactions: z.boolean().optional(),
})

export const createPayableSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  dueDate: dateOnly,
  description: z.string().trim().min(1).optional(),
  counterparty: z.string().trim().min(1).optional(),
  accountId: z.string().trim().min(1).optional(),
})

export const updatePayableSchema = z.object({
  amount: z.number().positive().optional(),
  dueDate: dateOnly.optional(),
  description: z.string().trim().min(1).nullable().optional(),
  counterparty: z.string().trim().min(1).nullable().optional(),
  accountId: z.string().trim().min(1).nullable().optional(),
})

export const listPayablesQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  status: z.enum(['pendente', 'vence_hoje', 'atrasada', 'paga', 'cancelada']).optional(),
  until: dateOnly.optional(),
  groupId: z.string().trim().min(1).optional(),
  accountId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
})

export const payPayableSchema = z.object({
  accountId: z.string().trim().min(1, 'accountId is required'),
  paidAmount: z.number().positive().optional(),
  date: dateOnly.optional(),
})

export const cancelPayableSchema = z.object({
  cancellationReason: z.string().trim().min(1).optional(),
  confirmDeleteTransaction: z.boolean().optional(),
})

export const deletePayableBodySchema = z.object({
  confirmDeleteTransaction: z.boolean().optional(),
})

export const summaryQuerySchema = z.object({
  until: dateOnly,
})
