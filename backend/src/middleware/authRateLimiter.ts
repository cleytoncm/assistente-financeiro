import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

/**
 * Keyed by IP + e-mail (not just IP) so different accounts from the same IP
 * aren't penalized together, per RF-06.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
    return `${req.ip}:${email}`
  },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
  },
})
