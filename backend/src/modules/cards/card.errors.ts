export class CardNameAlreadyExistsError extends Error {
  constructor() {
    super('Card name already exists')
    this.name = 'CardNameAlreadyExistsError'
  }
}

export class CardNotFoundError extends Error {
  constructor() {
    super('Card not found')
    this.name = 'CardNotFoundError'
  }
}

export class LinkedAccountNotFoundError extends Error {
  constructor() {
    super('Linked account not found')
    this.name = 'LinkedAccountNotFoundError'
  }
}
