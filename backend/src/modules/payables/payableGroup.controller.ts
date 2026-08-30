import type { Request, Response } from 'express'
import {
  createPayableGroupSchema,
  updatePayableGroupSchema,
  listPayableGroupsQuerySchema,
  deletePayableGroupQuerySchema,
  deletePayableGroupBodySchema,
} from './payable.schemas.js'
import {
  createPayableGroup,
  listPayableGroups,
  getPayableGroupDetail,
  updatePayableGroup,
  deletePayableGroup,
} from './payableGroup.service.js'
import {
  PayableGroupNotFoundError,
  PayableAccountNotFoundError,
  PayableAccountInactiveError,
  DeleteTransactionsConfirmationRequiredError,
} from './payable.errors.js'

function handleServiceError(error: unknown, res: Response): void {
  if (error instanceof PayableGroupNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }
  if (error instanceof PayableAccountNotFoundError || error instanceof PayableAccountInactiveError) {
    res.status(400).json({ error: error.message })
    return
  }
  if (error instanceof DeleteTransactionsConfirmationRequiredError) {
    res.status(409).json({ error: error.message, deletePaidCount: error.paidCount })
    return
  }
  /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
  throw error
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createPayableGroupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const group = await createPayableGroup(req.userId!, parsed.data)
    res.status(201).json(group)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function index(req: Request, res: Response): Promise<void> {
  const parsed = listPayableGroupsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
    return
  }

  const groups = await listPayableGroups(req.userId!, parsed.data)
  res.status(200).json(groups)
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const group = await getPayableGroupDetail(req.userId!, req.params.id as string)
    res.status(200).json(group)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updatePayableGroupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const group = await updatePayableGroup(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(group)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const parsedQuery = deletePayableGroupQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.issues[0]?.message ?? 'Invalid query' })
    return
  }
  const parsedBody = deletePayableGroupBodySchema.safeParse(req.body)
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    await deletePayableGroup(
      req.userId!,
      req.params.id as string,
      parsedQuery.data.scope,
      parsedBody.data.confirmDeleteTransactions
    )
    res.status(204).send()
  } catch (error) {
    handleServiceError(error, res)
  }
}
