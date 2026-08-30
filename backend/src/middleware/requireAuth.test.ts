import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth } from './requireAuth.js'

// Matches JWT_SECRET in .env.test, loaded by src/test/setup.ts before this file runs.
const TEST_SECRET = 'test-secret'

function makeRes(): Response {
  const res = {} as Response
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

function makeReq(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request
}

describe('requireAuth', () => {
  it('rejects a request without an Authorization header', () => {
    const req = makeReq(undefined)
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a request with a malformed Authorization header', () => {
    const req = makeReq('NotBearer sometoken')
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects an invalid token', () => {
    const req = makeReq('Bearer not-a-real-token')
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects an expired token', () => {
    const expiredToken = jwt.sign({ sub: 'user-1' }, TEST_SECRET, { expiresIn: -10 })
    const req = makeReq(`Bearer ${expiredToken}`)
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects a token with no sub claim', () => {
    const token = jwt.sign({ role: 'user' }, TEST_SECRET, { expiresIn: '1h' })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('accepts a valid token and populates req.userId', () => {
    const token = jwt.sign({ sub: 'user-1' }, TEST_SECRET, { expiresIn: '1h' })
    const req = makeReq(`Bearer ${token}`)
    const res = makeRes()
    const next = vi.fn()

    requireAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.userId).toBe('user-1')
    expect(res.status).not.toHaveBeenCalled()
  })
})
