export class InvoiceNotFoundError extends Error {
  constructor() {
    super('Invoice not found')
    this.name = 'InvoiceNotFoundError'
  }
}

export class InvoiceAlreadyPaidError extends Error {
  constructor() {
    super('Invoice is already paid')
    this.name = 'InvoiceAlreadyPaidError'
  }
}

export class InvalidInvoiceDatesError extends Error {
  constructor() {
    super('closingDate must be before dueDate')
    this.name = 'InvalidInvoiceDatesError'
  }
}

export class PaymentAccountNotFoundError extends Error {
  constructor() {
    super('Payment account not found')
    this.name = 'PaymentAccountNotFoundError'
  }
}

export class InvoiceNotOpenError extends Error {
  constructor() {
    super('This transaction belongs to an invoice that is no longer open')
    this.name = 'InvoiceNotOpenError'
  }
}

/**
 * Not a failure — signals that creating/editing this transaction would change the total of an
 * already-paid invoice, and the caller must resend with confirmPaymentAdjustment: true to
 * proceed (RF-06).
 */
export class PaymentAdjustmentConfirmationRequiredError extends Error {
  invoiceId: string
  oldAmount: string
  newAmount: string

  constructor(params: { invoiceId: string; oldAmount: string; newAmount: string }) {
    super('This invoice is already paid; confirm to update the payment amount')
    this.name = 'PaymentAdjustmentConfirmationRequiredError'
    this.invoiceId = params.invoiceId
    this.oldAmount = params.oldAmount
    this.newAmount = params.newAmount
  }
}
