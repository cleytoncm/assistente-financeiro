import type { Request, Response } from 'express'
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from './transaction.schemas.js'
import {
  createTransaction,
  listTransactions,
  updateTransaction,
  deleteTransaction,
} from './transaction.service.js'
import {
  DestinationNotFoundError,
  DestinationInactiveError,
  CategoryNotFoundError,
  CategoryTypeMismatchError,
  RefundTargetNotFoundError,
  RefundTypeMismatchError,
  RefundDestinationMismatchError,
  RefundAmountExceedsOriginalError,
  TransactionNotFoundError,
} from './transaction.errors.js'

function handleServiceError(error: unknown, res: Response): void {
  if (
    error instanceof CategoryNotFoundError ||
    error instanceof RefundTargetNotFoundError ||
    error instanceof RefundTypeMismatchError ||
    error instanceof RefundDestinationMismatchError ||
    error instanceof RefundAmountExceedsOriginalError
  ) {
    res.status(400).json({ error: error.message })
    return
  }
  if (error instanceof DestinationNotFoundError || error instanceof TransactionNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }
  if (error instanceof DestinationInactiveError || error instanceof CategoryTypeMismatchError) {
    res.status(409).json({ error: error.message })
    return
  }
  /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
  throw error
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createTransactionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const transactions = await createTransaction(req.userId!, parsed.data)
    res.status(201).json(parsed.data.installments ? transactions : transactions[0])
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const parsed = listTransactionsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
    return
  }

  const result = await listTransactions(req.userId!, parsed.data)
  res.status(200).json(result)
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updateTransactionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  const applyToRemaining = req.query.applyToRemaining === 'true'

  try {
    const transaction = await updateTransaction(
      req.userId!,
      req.params.id as string,
      parsed.data,
      applyToRemaining
    )
    res.status(200).json(transaction)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const scope = req.query.scope === 'remaining' ? 'remaining' : 'single'

  try {
    await deleteTransaction(req.userId!, req.params.id as string, scope)
    res.status(204).send()
  } catch (error) {
    handleServiceError(error, res)
  }
}
