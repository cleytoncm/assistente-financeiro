import type { Request, Response } from 'express'
import { createCategorySchema } from './category.schemas.js'
import { listCategories, createCategory } from './category.service.js'
import { CategoryAlreadyExistsError } from './category.errors.js'

export async function index(req: Request, res: Response): Promise<void> {
  const categories = await listCategories(req.userId!)
  res.status(200).json(categories)
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const category = await createCategory(req.userId!, parsed.data)
    res.status(201).json(category)
  } catch (error) {
    if (error instanceof CategoryAlreadyExistsError) {
      res.status(409).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}
