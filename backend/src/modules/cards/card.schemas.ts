import { z } from 'zod'

const dayOfMonth = z.number().int().min(1).max(31)

export const createCardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  creditLimit: z.number().positive('Credit limit must be positive'),
  closingDay: dayOfMonth,
  dueDay: dayOfMonth,
  linkedAccountId: z.string().trim().min(1).optional(),
})

export const updateCardSchema = z.object({
  name: z.string().trim().min(1).optional(),
  creditLimit: z.number().positive().optional(),
  closingDay: dayOfMonth.optional(),
  dueDay: dayOfMonth.optional(),
  linkedAccountId: z.string().trim().min(1).nullable().optional(),
})
