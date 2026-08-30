export class BankCodeAlreadyExistsError extends Error {
  constructor() {
    super('Bank code already exists')
    this.name = 'BankCodeAlreadyExistsError'
  }
}
