export class PayableNotFoundError extends Error {
  constructor() {
    super('Payable not found')
    this.name = 'PayableNotFoundError'
  }
}

export class PayableGroupNotFoundError extends Error {
  constructor() {
    super('Payable group not found')
    this.name = 'PayableGroupNotFoundError'
  }
}

export class PayableAccountNotFoundError extends Error {
  constructor() {
    super('Account not found')
    this.name = 'PayableAccountNotFoundError'
  }
}

export class PayableAccountInactiveError extends Error {
  constructor() {
    super('Account is inactive')
    this.name = 'PayableAccountInactiveError'
  }
}

export class PayableAlreadyPaidError extends Error {
  constructor() {
    super('Payable is already paid')
    this.name = 'PayableAlreadyPaidError'
  }
}

export class PayableAlreadyCancelledError extends Error {
  constructor() {
    super('Payable is already cancelled')
    this.name = 'PayableAlreadyCancelledError'
  }
}

export class PayableNotEditableError extends Error {
  constructor() {
    super('Payable cannot be edited once paid or cancelled')
    this.name = 'PayableNotEditableError'
  }
}

/**
 * Not a failure by itself — signals that deleting/cancelling this already-paid payable would
 * also remove its linked Transaction, and the caller must resend with
 * confirmDeleteTransaction: true to proceed (RF-08/RF-09).
 */
export class DeleteTransactionConfirmationRequiredError extends Error {
  transaction: { id: string; amount: string; date: string; accountId: string | null }

  constructor(transaction: { id: string; amount: string; date: string; accountId: string | null }) {
    super('This payable is already paid; confirm to also delete its linked transaction')
    this.name = 'DeleteTransactionConfirmationRequiredError'
    this.transaction = transaction
  }
}

/** Same as above, but for a bulk group deletion (RF-10) covering more than one paid payable. */
export class DeleteTransactionsConfirmationRequiredError extends Error {
  paidCount: number

  constructor(paidCount: number) {
    super('This group has paid payables; confirm to also delete their linked transactions')
    this.name = 'DeleteTransactionsConfirmationRequiredError'
    this.paidCount = paidCount
  }
}
