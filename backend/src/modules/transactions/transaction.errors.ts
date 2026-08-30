export class DestinationNotFoundError extends Error {
  constructor() {
    super('Account or card not found')
    this.name = 'DestinationNotFoundError'
  }
}

export class DestinationInactiveError extends Error {
  constructor() {
    super('This account or card is inactive and cannot receive new transactions')
    this.name = 'DestinationInactiveError'
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super('Category not found')
    this.name = 'CategoryNotFoundError'
  }
}

export class CategoryTypeMismatchError extends Error {
  constructor() {
    super('Category type does not match transaction type')
    this.name = 'CategoryTypeMismatchError'
  }
}

export class RefundTargetNotFoundError extends Error {
  constructor() {
    super('Refund target transaction not found')
    this.name = 'RefundTargetNotFoundError'
  }
}

export class RefundTypeMismatchError extends Error {
  constructor() {
    super('Refund must have the opposite type of the original transaction')
    this.name = 'RefundTypeMismatchError'
  }
}

export class RefundDestinationMismatchError extends Error {
  constructor() {
    super('Refund must be on the same account or card as the original transaction')
    this.name = 'RefundDestinationMismatchError'
  }
}

export class RefundAmountExceedsOriginalError extends Error {
  constructor() {
    super('Refund amount cannot exceed the original transaction amount')
    this.name = 'RefundAmountExceedsOriginalError'
  }
}

export class TransactionNotFoundError extends Error {
  constructor() {
    super('Transaction not found')
    this.name = 'TransactionNotFoundError'
  }
}
