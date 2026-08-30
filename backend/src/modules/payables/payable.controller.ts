import type { Request, Response } from 'express'
import {
  createPayableSchema,
  updatePayableSchema,
  listPayablesQuerySchema,
  payPayableSchema,
  cancelPayableSchema,
  deletePayableBodySchema,
  summaryQuerySchema,
} from './payable.schemas.js'
import {
  createPayable,
  listPayables,
  getPayableDetail,
  updatePayable,
  payPayable,
  cancelPayable,
  deletePayable,
  getPayablesSummary,
} from './payable.service.js'
import {
  PayableNotFoundError,
  PayableNotEditableError,
  PayableAlreadyPaidError,
  PayableAlreadyCancelledError,
  PayableAccountNotFoundError,
  PayableAccountInactiveError,
  DeleteTransactionConfirmationRequiredError,
} from './payable.errors.js'

function handleServiceError(error: unknown, res: Response): void {
  if (error instanceof PayableNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }
  if (error instanceof PayableAccountNotFoundError || error instanceof PayableAccountInactiveError) {
    res.status(400).json({ error: error.message })
    return
  }
  if (
    error instanceof PayableNotEditableError ||
    error instanceof PayableAlreadyPaidError ||
    error instanceof PayableAlreadyCancelledError
  ) {
    res.status(409).json({ error: error.message })
    return
  }
  if (error instanceof DeleteTransactionConfirmationRequiredError) {
    res.status(409).json({ error: error.message, deleteTransaction: error.transaction })
    return
  }
  /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
  throw error
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createPayableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const payable = await createPayable(req.userId!, parsed.data)
    res.status(201).json(payable)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const parsed = listPayablesQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
    return
  }

  const result = await listPayables(req.userId!, parsed.data)
  res.status(200).json(result)
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const payable = await getPayableDetail(req.userId!, req.params.id as string)
    res.status(200).json(payable)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updatePayableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const payable = await updatePayable(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(payable)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function pay(req: Request, res: Response): Promise<void> {
  const parsed = payPayableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const payable = await payPayable(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(payable)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const parsed = cancelPayableSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const payable = await cancelPayable(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(payable)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const parsed = deletePayableBodySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    await deletePayable(req.userId!, req.params.id as string, parsed.data.confirmDeleteTransaction)
    res.status(204).send()
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function summary(req: Request, res: Response): Promise<void> {
  const parsed = summaryQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
    return
  }

  const result = await getPayablesSummary(req.userId!, parsed.data.until)
  res.status(200).json(result)
}
