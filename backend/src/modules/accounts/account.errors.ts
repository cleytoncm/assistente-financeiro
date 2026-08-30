export class AccountNameAlreadyExistsError extends Error {
  constructor() {
    super('Account name already exists')
    this.name = 'AccountNameAlreadyExistsError'
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super('Account not found')
    this.name = 'AccountNotFoundError'
  }
}

export class BankNotFoundError extends Error {
  constructor() {
    super('Bank not found')
    this.name = 'BankNotFoundError'
  }
}
