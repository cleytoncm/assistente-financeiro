import { z } from 'zod'

const currencySchema = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO 4217 code')
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO 4217 code')
  .transform((value) => value.toUpperCase())

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  bankId: z.string().trim().min(1, 'Bank is required'),
  currency: currencySchema.optional(),
  initialBalance: z.number().finite(),
})

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  bankId: z.string().trim().min(1).optional(),
  currency: currencySchema.optional(),
})

export const updateAccountStatusSchema = z.object({
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
})
