export class CategoryAlreadyExistsError extends Error {
  constructor() {
    super('A category with this name and type already exists')
    this.name = 'CategoryAlreadyExistsError'
  }
}
