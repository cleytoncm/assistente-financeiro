import { processImportBatch } from './importProcessor.js'

export interface ImportQueue {
  enqueueProcessing(importBatchId: string): void
}

/**
 * Local/dev/test queue: runs processing in-process right after the HTTP response would be sent
 * (RF-01/RF-02 — upload responds immediately, without waiting for processing to finish).
 * Production swaps this for a Cloud Tasks-backed queue that POSTs to
 * `/internal/import-batches/:id/process` instead (constitution.md, "Decisões técnicas" — Cloud
 * Run throttles CPU after the response is sent, so in-process fire-and-forget isn't reliable
 * there); this interface is what makes that swap a one-file change once Cloud Tasks credentials
 * exist.
 */
class InProcessImportQueue implements ImportQueue {
  enqueueProcessing(importBatchId: string): void {
    setImmediate(() => {
      processImportBatch(importBatchId).catch((error: unknown) => {
        /* v8 ignore next -- processImportBatch already catches and records every failure it can anticipate; this only guards against a truly unexpected throw */
        console.error(`Failed to process import batch ${importBatchId}`, error)
      })
    })
  }
}

const queue: ImportQueue = new InProcessImportQueue()

export function getImportQueue(): ImportQueue {
  return queue
}
