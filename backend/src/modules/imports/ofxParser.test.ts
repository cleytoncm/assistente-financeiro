import { describe, expect, it } from 'vitest'
import { parseOfx } from './ofxParser.js'
import { ExtractionError } from './extraction.types.js'

function ofx(transactions: string): string {
  return `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>${transactions}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

describe('parseOfx', () => {
  it('extracts an expense from a negative TRNAMT', () => {
    const rows = parseOfx(
      ofx(
        `<STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20240115\n<TRNAMT>-50.00\n<FITID>abc123\n<MEMO>Mercado\n</STMTTRN>`
      )
    )
    expect(rows).toEqual([
      { date: new Date('2024-01-15T00:00:00.000Z'), description: 'Mercado', amount: '50.00', type: 'expense', externalId: 'abc123' },
    ])
  })

  it('extracts an income from a positive TRNAMT', () => {
    const rows = parseOfx(
      ofx(`<STMTTRN><DTPOSTED>20240201\n<TRNAMT>1200.50\n<FITID>xyz789\n<MEMO>Salário\n</STMTTRN>`)
    )
    expect(rows[0]).toMatchObject({ amount: '1200.50', type: 'income' })
  })

  it('extracts multiple transactions from the same file', () => {
    const rows = parseOfx(
      ofx(
        `<STMTTRN><DTPOSTED>20240101\n<TRNAMT>-10.00\n<FITID>a\n<MEMO>Um\n</STMTTRN>` +
          `<STMTTRN><DTPOSTED>20240102\n<TRNAMT>-20.00\n<FITID>b\n<MEMO>Dois\n</STMTTRN>`
      )
    )
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.externalId)).toEqual(['a', 'b'])
  })

  it('falls back to NAME when MEMO is absent', () => {
    const rows = parseOfx(
      ofx(`<STMTTRN><DTPOSTED>20240101\n<TRNAMT>-10.00\n<FITID>a\n<NAME>Loja X\n</STMTTRN>`)
    )
    expect(rows[0]!.description).toBe('Loja X')
  })

  it('parses XML-style (OFX 2.x) closed tags', () => {
    const rows = parseOfx(
      ofx(
        `<STMTTRN><DTPOSTED>20240101</DTPOSTED><TRNAMT>-15.00</TRNAMT><FITID>c</FITID><MEMO>Padaria</MEMO></STMTTRN>`
      )
    )
    expect(rows[0]).toMatchObject({ amount: '15.00', description: 'Padaria' })
  })

  it('omits externalId when FITID is absent', () => {
    const rows = parseOfx(ofx(`<STMTTRN><DTPOSTED>20240101\n<TRNAMT>-10.00\n<MEMO>Sem fitid\n</STMTTRN>`))
    expect(rows[0]!.externalId).toBeUndefined()
  })

  it('throws when the file has no STMTTRN blocks', () => {
    expect(() => parseOfx('not an ofx file')).toThrow(ExtractionError)
  })

  it('throws when a transaction is missing DTPOSTED or TRNAMT', () => {
    expect(() => parseOfx(ofx(`<STMTTRN><TRNAMT>-10.00\n<MEMO>Sem data\n</STMTTRN>`))).toThrow(ExtractionError)
    expect(() => parseOfx(ofx(`<STMTTRN><DTPOSTED>20240101\n<MEMO>Sem valor\n</STMTTRN>`))).toThrow(ExtractionError)
  })

  it('throws on an invalid date', () => {
    expect(() =>
      parseOfx(ofx(`<STMTTRN><DTPOSTED>notadate\n<TRNAMT>-10.00\n<MEMO>X\n</STMTTRN>`))
    ).toThrow(ExtractionError)
  })

  it('throws on a zero or non-numeric amount', () => {
    expect(() => parseOfx(ofx(`<STMTTRN><DTPOSTED>20240101\n<TRNAMT>0.00\n<MEMO>X\n</STMTTRN>`))).toThrow(
      ExtractionError
    )
    expect(() => parseOfx(ofx(`<STMTTRN><DTPOSTED>20240101\n<TRNAMT>abc\n<MEMO>X\n</STMTTRN>`))).toThrow(
      ExtractionError
    )
  })

  it('defaults to a placeholder description when MEMO and NAME are both absent', () => {
    const rows = parseOfx(ofx(`<STMTTRN><DTPOSTED>20240101\n<TRNAMT>-10.00\n<FITID>a\n</STMTTRN>`))
    expect(rows[0]!.description).toBe('Sem descrição')
  })
})
