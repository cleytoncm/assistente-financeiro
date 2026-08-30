import { describe, expect, it } from 'vitest'
import { FakeLlmExtractor, getLlmExtractor } from './llmExtractor.js'
import { ExtractionError } from './extraction.types.js'

describe('FakeLlmExtractor', () => {
  const extractor = new FakeLlmExtractor()

  it('extracts rows from simple date,description,amount,type CSV lines', async () => {
    const rows = await extractor.extractFromCsv('2024-01-10,Mercado,50,expense\n2024-01-15,Salário,2000,income')
    expect(rows).toEqual([
      { date: new Date('2024-01-10T00:00:00.000Z'), description: 'Mercado', amount: '50.00', type: 'expense' },
      { date: new Date('2024-01-15T00:00:00.000Z'), description: 'Salário', amount: '2000.00', type: 'income' },
    ])
  })

  it('ignores blank lines', async () => {
    const rows = await extractor.extractFromCsv('\n2024-01-10,Mercado,50,expense\n\n')
    expect(rows).toHaveLength(1)
  })

  it('throws on an empty file', async () => {
    await expect(extractor.extractFromCsv('   \n  ')).rejects.toThrow(ExtractionError)
  })

  it('throws when a required field is missing', async () => {
    await expect(extractor.extractFromCsv('2024-01-10,Mercado,50')).rejects.toThrow(ExtractionError)
  })

  it('throws on an invalid type', async () => {
    await expect(extractor.extractFromCsv('2024-01-10,Mercado,50,other')).rejects.toThrow(ExtractionError)
  })

  it('throws on an invalid date', async () => {
    await expect(extractor.extractFromCsv('not-a-date,Mercado,50,expense')).rejects.toThrow(ExtractionError)
  })

  it('throws on a non-positive amount', async () => {
    await expect(extractor.extractFromCsv('2024-01-10,Mercado,0,expense')).rejects.toThrow(ExtractionError)
    await expect(extractor.extractFromCsv('2024-01-10,Mercado,-5,expense')).rejects.toThrow(ExtractionError)
  })

  it('treats PDF bytes as the same UTF-8 CSV-shaped text', async () => {
    const rows = await extractor.extractFromPdf(Buffer.from('2024-02-01,Fatura,120,expense', 'utf-8'))
    expect(rows).toEqual([
      { date: new Date('2024-02-01T00:00:00.000Z'), description: 'Fatura', amount: '120.00', type: 'expense' },
    ])
  })
})

describe('getLlmExtractor', () => {
  it('returns a FakeLlmExtractor when Vertex AI is not configured (test env)', () => {
    expect(getLlmExtractor()).toBeInstanceOf(FakeLlmExtractor)
  })

  it('returns the same cached instance on repeated calls', () => {
    expect(getLlmExtractor()).toBe(getLlmExtractor())
  })
})
