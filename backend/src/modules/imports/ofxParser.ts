import { ExtractionError, type ExtractedRow } from './extraction.types.js'

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^\\r\\n<]*)`, 'i'))
  return match ? match[1]!.trim() : null
}

function parseOfxDate(raw: string): Date {
  const digits = raw.slice(0, 8)
  if (!/^\d{8}$/.test(digits)) {
    throw new ExtractionError(`Invalid OFX date: ${raw}`)
  }
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Deterministic OFX parser (RF-03) — no LLM involved, so FITID is preserved exactly for exact
 * duplicate detection (RF-04). Works against both SGML-tag-soup OFX 1.x (unclosed tags) and
 * XML-style OFX 2.x, since both put a tag's value directly after its opening tag on the same
 * line.
 */
export function parseOfx(content: string): ExtractedRow[] {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi)
  if (!blocks || blocks.length === 0) {
    throw new ExtractionError('No transactions found in OFX file')
  }

  return blocks.map((block) => {
    const dtPosted = extractTag(block, 'DTPOSTED')
    const trnAmt = extractTag(block, 'TRNAMT')
    const fitId = extractTag(block, 'FITID')
    const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME')

    if (!dtPosted || !trnAmt) {
      throw new ExtractionError('OFX transaction missing DTPOSTED or TRNAMT')
    }

    const amountValue = Number(trnAmt)
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      throw new ExtractionError(`Invalid OFX amount: ${trnAmt}`)
    }

    const row: ExtractedRow = {
      date: parseOfxDate(dtPosted),
      description: memo ?? 'Sem descrição',
      amount: Math.abs(amountValue).toFixed(2),
      type: amountValue < 0 ? 'expense' : 'income',
    }
    if (fitId) row.externalId = fitId
    return row
  })
}
