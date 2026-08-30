export type ExtractedRow = {
  date: Date
  description: string
  amount: string
  type: 'income' | 'expense'
  externalId?: string
}

/** Thrown when a file's content can't be extracted with confidence — fails the whole batch (RF-07). */
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}
