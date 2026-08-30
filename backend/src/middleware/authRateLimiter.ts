import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'

/**
 * Keyed by IP + e-mail (not just IP) so different accounts from the same IP
 * aren't penalized together, per RF-06. Uses express-rate-limit's ipKeyGenerator
 * helper to normalize IPv6 addresses (otherwise varying the address within the
 * same /64 would let a client bypass the limit).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`
  },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts. Try again later.' })
  },
})
