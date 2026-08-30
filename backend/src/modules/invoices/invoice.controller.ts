import type { Request, Response } from 'express'
import { updateInvoiceSchema, payInvoiceSchema } from './invoice.schemas.js'
import {
  listInvoicesForCard,
  getInvoiceDetail,
  updateInvoiceDates,
  payInvoice,
} from './invoice.service.js'
import { listTransactions } from '../transactions/transaction.service.js'
import {
  InvalidInvoiceDatesError,
  InvoiceAlreadyPaidError,
  InvoiceNotFoundError,
  PaymentAccountNotFoundError,
} from './invoice.errors.js'

function handleServiceError(error: unknown, res: Response): void {
  if (error instanceof InvoiceNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }
  if (error instanceof InvoiceAlreadyPaidError || error instanceof InvalidInvoiceDatesError) {
    res.status(409).json({ error: error.message })
    return
  }
  if (error instanceof PaymentAccountNotFoundError) {
    res.status(400).json({ error: error.message })
    return
  }
  /* v8 ignore next -- defensive re-throw for unexpected errors, not triggerable in tests */
  throw error
}

export async function listByCard(req: Request, res: Response): Promise<void> {
  const invoices = await listInvoicesForCard(req.userId!, req.params.id as string)
  res.status(200).json(invoices)
}

export async function show(req: Request, res: Response): Promise<void> {
  try {
    const invoice = await getInvoiceDetail(req.userId!, req.params.id as string)
    res.status(200).json(invoice)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function transactions(req: Request, res: Response): Promise<void> {
  const result = await listTransactions(req.userId!, { invoiceId: req.params.id as string })
  res.status(200).json(result)
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = updateInvoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const invoice = await updateInvoiceDates(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(invoice)
  } catch (error) {
    handleServiceError(error, res)
  }
}

export async function pay(req: Request, res: Response): Promise<void> {
  const parsed = payInvoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const invoice = await payInvoice(req.userId!, req.params.id as string, parsed.data)
    res.status(200).json(invoice)
  } catch (error) {
    handleServiceError(error, res)
  }
}
