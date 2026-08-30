import type { Request, Response } from 'express'
import { createBankSchema } from './bank.schemas.js'
import { listBanks, createBank } from './bank.service.js'
import { BankCodeAlreadyExistsError } from './bank.errors.js'

export async function index(_req: Request, res: Response): Promise<void> {
  const banks = await listBanks()
  res.status(200).json(banks)
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createBankSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const bank = await createBank(parsed.data)
    res.status(201).json(bank)
  } catch (error) {
    if (error instanceof BankCodeAlreadyExistsError) {
      res.status(409).json({ error: 'Bank code already exists' })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}
