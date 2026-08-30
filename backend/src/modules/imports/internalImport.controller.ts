import type { Request, Response } from 'express'
import { env } from '../../config/env.js'
import { processImportBatch } from './importProcessor.js'

/**
 * Guards the endpoint a real Cloud Tasks queue would call in production. Stands in for Cloud
 * Tasks' OIDC token validation (constitution.md, same rationale as the Telegram webhook secret)
 * until that's wired up — compares a shared secret header instead. The in-process queue used
 * locally (importQueue.ts) never calls this over HTTP; it invokes processImportBatch directly.
 */
export async function process(req: Request, res: Response): Promise<void> {
  if (!env.internalTasksSecret || req.headers['x-internal-secret'] !== env.internalTasksSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  await processImportBatch(req.params.id as string)
  res.status(200).json({ ok: true })
}
