import type { Request, Response } from 'express'
import { createAccountSchema, updateAccountSchema, updateAccountStatusSchema } from './account.schemas.js'
import {
  createAccount,
  listAccounts,
  updateAccount,
  updateAccountStatus,
  deleteAccount,
} from './account.service.js'
import {
  AccountHasTransactionsError,
  AccountNameAlreadyExistsError,
  AccountNotFoundError,
  BankNotFoundError,
} from './account.errors.js'

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createAccountSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const account = await createAccount(req.userId!, parsed.data)
    res.status(201).json(account)
  } catch (error) {
    if (error instanceof AccountNameAlreadyExistsError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof BankNotFoundError) {
      res.status(400).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  const includeHidden = req.query.includeHidden === 'true'
  const accounts = await listAccounts(req.userId!, { date, includeHidden })
  res.status(200).json(accounts)
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updateAccountSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const account = await updateAccount(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(account)
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      res.status(404).json({ error: error.message })
      return
    }
    if (error instanceof AccountNameAlreadyExistsError) {
      res.status(409).json({ error: error.message })
      return
    }
    if (error instanceof BankNotFoundError) {
      res.status(400).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  const parsed = updateAccountStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const account = await updateAccountStatus(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(account)
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      res.status(404).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const cascade = req.query.cascade === 'true'

  try {
    await deleteAccount(req.userId!, req.params.id as string, cascade)
    res.status(204).send()
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      res.status(404).json({ error: error.message })
      return
    }
    if (error instanceof AccountHasTransactionsError) {
      res.status(409).json({ error: error.message })
      return
    }
    /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
    throw error
  }
}
