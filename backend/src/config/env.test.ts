import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('env', () => {
  const originalJwtSecret = process.env.JWT_SECRET

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret
  })

  it('throws when a required environment variable is missing', async () => {
    delete process.env.JWT_SECRET
    await expect(import('./env.js')).rejects.toThrow(
      'Missing required environment variable: JWT_SECRET'
    )
  })

  it('loads successfully when all required variables are present', async () => {
    process.env.JWT_SECRET = 'some-secret'
    const { env } = await import('./env.js')
    expect(env.jwtSecret).toBe('some-secret')
  })
})
