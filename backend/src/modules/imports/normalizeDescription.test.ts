import { describe, expect, it } from 'vitest'
import { normalizeDescription } from './normalizeDescription.js'

describe('normalizeDescription', () => {
  it('lowercases the description', () => {
    expect(normalizeDescription('MERCADO EXTRA')).toBe('mercado extra')
  })

  it('strips accents', () => {
    expect(normalizeDescription('Mercadó Ñandú')).toBe('mercado nandu')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeDescription('  Mercado  ')).toBe('mercado')
  })

  it('collapses internal whitespace runs into a single space', () => {
    expect(normalizeDescription('Mercado   Extra')).toBe('mercado extra')
  })

  it('treats equivalent descriptions as equal after normalization', () => {
    expect(normalizeDescription('Mercadó  Extra')).toBe(normalizeDescription('  mercado extra  '))
  })
})
