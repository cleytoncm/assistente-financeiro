export class ImportBatchNotFoundError extends Error {
  constructor() {
    super('Import batch not found')
    this.name = 'ImportBatchNotFoundError'
  }
}

export class ImportedRowNotFoundError extends Error {
  constructor() {
    super('Imported row not found')
    this.name = 'ImportedRowNotFoundError'
  }
}

export class ImportDestinationNotFoundError extends Error {
  constructor() {
    super('Destination account or card not found')
    this.name = 'ImportDestinationNotFoundError'
  }
}

export class ImportDestinationInactiveError extends Error {
  constructor() {
    super('Destination account or card is inactive')
    this.name = 'ImportDestinationInactiveError'
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super('File exceeds the 10 MB limit')
    this.name = 'FileTooLargeError'
  }
}

export class InvalidFileExtensionError extends Error {
  constructor(expectedExtension: string) {
    super(`File extension must match the selected format (${expectedExtension})`)
    this.name = 'InvalidFileExtensionError'
  }
}

/** Not a failure — RF-01 requires explicit confirmation to re-import a file already completed before. */
export class DuplicateFileConfirmationRequiredError extends Error {
  previousImportBatchId: string
  previousImportedAt: Date

  constructor(previousImportBatchId: string, previousImportedAt: Date) {
    super('An identical file was already imported successfully; confirm to import it again')
    this.name = 'DuplicateFileConfirmationRequiredError'
    this.previousImportBatchId = previousImportBatchId
    this.previousImportedAt = previousImportedAt
  }
}

export class ImportBatchNotAwaitingReviewError extends Error {
  constructor() {
    super('Import batch is not awaiting review')
    this.name = 'ImportBatchNotAwaitingReviewError'
  }
}

export class ImportedRowNotPendingError extends Error {
  constructor() {
    super('Imported row is not pending review')
    this.name = 'ImportedRowNotPendingError'
  }
}
