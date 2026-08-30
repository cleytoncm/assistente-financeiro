import type { Request, Response } from 'express'
import { createCardSchema, updateCardSchema } from './card.schemas.js'
import { createCard, listCards, updateCard, deleteCard } from './card.service.js'
import { CardNameAlreadyExistsError, CardNotFoundError, LinkedAccountNotFoundError } from './card.errors.js'

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createCardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const card = await createCard(req.userId!, parsed.data)
    res.status(201).json(card)
  } catch (error) {
    if (error instanceof CardNameAlreadyExistsError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof LinkedAccountNotFoundError) {
      res.status(400).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const cards = await listCards(req.userId!)
  res.status(200).json(cards)
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updateCardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const card = await updateCard(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(card)
  } catch (error) {
    if (error instanceof CardNotFoundError) {
      res.status(404).json({ error: error.message })
      return
    }
    if (error instanceof CardNameAlreadyExistsError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof LinkedAccountNotFoundError) {
      res.status(400).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteCard(req.userId!, req.params.id as string)
    res.status(204).send()
  } catch (error) {
    if (error instanceof CardNotFoundError) {
      res.status(404).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}
