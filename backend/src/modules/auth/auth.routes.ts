import { Router } from 'express'
import { register, login, me } from './auth.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'
import { authRateLimiter } from '../../middleware/authRateLimiter.js'

export const authRouter = Router()

authRouter.post('/register', authRateLimiter, register)
authRouter.post('/login', authRateLimiter, login)
authRouter.get('/me', requireAuth, me)
