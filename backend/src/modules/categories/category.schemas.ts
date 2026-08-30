import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
})
