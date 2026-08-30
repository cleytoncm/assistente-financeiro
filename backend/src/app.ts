import express, { type Express } from 'express'
import cors from 'cors'
import { authRouter } from './modules/auth/auth.routes.js'

export function createApp(): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true })
  })

  app.use('/auth', authRouter)

  return app
}
