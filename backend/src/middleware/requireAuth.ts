import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = header.slice('Bearer '.length)

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'Invalid token' })
      return
    }
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
