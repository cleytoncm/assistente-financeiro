import { describe, expect, it } from 'vitest'
import { scopedToUser } from './scopedToUser.js'

describe('scopedToUser', () => {
  it('adds userId to an empty where clause', () => {
    const result = scopedToUser('user-1', {})
    expect(result).toEqual({ where: { userId: 'user-1' } })
  })

  it('merges userId alongside existing where filters', () => {
    const result = scopedToUser('user-1', { where: { isActive: true } })
    expect(result).toEqual({ where: { isActive: true, userId: 'user-1' } })
  })

  it('preserves other query args untouched', () => {
    const result = scopedToUser('user-1', { where: { isActive: true }, orderBy: { createdAt: 'desc' } })
    expect(result).toEqual({
      where: { isActive: true, userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('never lets client-supplied where.userId override the authenticated user', () => {
    const result = scopedToUser('user-1', { where: { userId: 'attacker-controlled' } })
    expect(result.where.userId).toBe('user-1')
  })

  it('adds a where clause even when args has no where property at all', () => {
    const result = scopedToUser('user-1', { include: { bank: true }, orderBy: { name: 'asc' } })
    expect(result).toEqual({
      include: { bank: true },
      orderBy: { name: 'asc' },
      where: { userId: 'user-1' },
    })
  })
})
