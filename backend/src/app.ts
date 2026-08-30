import express, { type Express } from 'express'
import cors from 'cors'
import { authRouter } from './modules/auth/auth.routes.js'
import { bankRouter } from './modules/banks/bank.routes.js'
import { accountRouter } from './modules/accounts/account.routes.js'
import { cardRouter } from './modules/cards/card.routes.js'
import { categoryRouter } from './modules/categories/category.routes.js'
import { transactionRouter } from './modules/transactions/transaction.routes.js'

export function createApp(): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true })
  })

  app.use('/auth', authRouter)
  app.use('/banks', bankRouter)
  app.use('/accounts', accountRouter)
  app.use('/cards', cardRouter)
  app.use('/categories', categoryRouter)
  app.use('/transactions', transactionRouter)

  return app
}
