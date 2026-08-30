import { GoogleGenAI, Type } from '@google/genai'
import { env } from '../../config/env.js'
import { ExtractionError, type ExtractedRow } from './extraction.types.js'

export interface LlmExtractor {
  extractFromCsv(text: string): Promise<ExtractedRow[]>
  extractFromPdf(bytes: Buffer): Promise<ExtractedRow[]>
}

type RawLlmRow = { date: string; description: string; amount: number; type: 'income' | 'expense' }

function toExtractedRows(rows: unknown): ExtractedRow[] {
  if (!Array.isArray(rows)) throw new ExtractionError('LLM response was not a list of rows')

  return rows.map((raw) => {
    const row = raw as Partial<RawLlmRow>
    if (
      typeof row.date !== 'string' ||
      typeof row.description !== 'string' ||
      typeof row.amount !== 'number' ||
      (row.type !== 'income' && row.type !== 'expense')
    ) {
      throw new ExtractionError(`LLM returned an incomplete/invalid row: ${JSON.stringify(raw)}`)
    }
    const date = new Date(`${row.date}T00:00:00.000Z`)
    if (Number.isNaN(date.getTime()) || !Number.isFinite(row.amount) || row.amount <= 0) {
      throw new ExtractionError(`LLM returned an invalid row: ${JSON.stringify(raw)}`)
    }
    return { date, description: row.description, amount: row.amount.toFixed(2), type: row.type }
  })
}

const ROWS_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: 'YYYY-MM-DD' },
      description: { type: Type.STRING },
      amount: { type: Type.NUMBER, description: 'Always positive; sign is carried by type' },
      type: { type: Type.STRING, enum: ['income', 'expense'] },
    },
    required: ['date', 'description', 'amount', 'type'],
  },
}

const EXTRACTION_PROMPT =
  'Extract every financial transaction from the attached content as a JSON array of ' +
  '{ date, description, amount, type }. `date` must be YYYY-MM-DD. `amount` must always be ' +
  'positive. `type` must be "expense" for money going out and "income" for money coming in ' +
  '(infer from sign, or from terms like "débito"/"crédito", or from context — a credit card ' +
  'statement is mostly "expense", with "income" reserved for explicit refunds/credits). If a ' +
  'row cannot be confidently extracted, omit it rather than guessing.'

/**
 * Real Gemini-backed extractor (RF-03), used only when Vertex AI is configured (see
 * getLlmExtractor()). Authenticates via the Cloud Run service account (Application Default
 * Credentials), matching the constitution's decision to avoid an API key in Secret Manager for
 * this integration. NOTE: this path has not been exercised against a live Vertex AI project —
 * there are no GCP credentials in the environment this was written in — so validate it against
 * a real project before relying on it in production.
 */
export class VertexGeminiExtractor implements LlmExtractor {
  private client: GoogleGenAI

  constructor(projectId: string, location: string) {
    this.client = new GoogleGenAI({ vertexai: true, project: projectId, location })
  }

  async extractFromCsv(text: string): Promise<ExtractedRow[]> {
    const response = await this.client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: `${EXTRACTION_PROMPT}\n\nCSV:\n${text}` }] }],
      config: { responseMimeType: 'application/json', responseSchema: ROWS_RESPONSE_SCHEMA },
    })
    return this.parseResponse(response.text)
  }

  async extractFromPdf(bytes: Buffer): Promise<ExtractedRow[]> {
    const response = await this.client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_PROMPT },
            { inlineData: { data: bytes.toString('base64'), mimeType: 'application/pdf' } },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema: ROWS_RESPONSE_SCHEMA },
    })
    return this.parseResponse(response.text)
  }

  private parseResponse(text: string | undefined): ExtractedRow[] {
    if (!text) throw new ExtractionError('Empty response from Vertex AI')
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ExtractionError('Vertex AI response was not valid JSON')
    }
    return toExtractedRows(parsed)
  }
}

/**
 * Deterministic stand-in for VertexGeminiExtractor, used whenever Vertex AI isn't configured
 * (local dev, automated tests — see getLlmExtractor()). Understands a simple
 * `date,description,amount,type` CSV shape for both "CSV" and "PDF" input (for the fake, PDF
 * bytes are just that same text UTF-8-encoded — a real PDF's binary content wouldn't parse this
 * way, but nothing in this codebase asks the fake to actually decode a real PDF).
 */
export class FakeLlmExtractor implements LlmExtractor {
  async extractFromCsv(text: string): Promise<ExtractedRow[]> {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) throw new ExtractionError('Empty file')

    return lines.map((line) => {
      const [date, description, amount, type] = line.split(',').map((part) => part.trim())
      return toExtractedRows([{ date, description, amount: Number(amount), type }])[0]!
    })
  }

  async extractFromPdf(bytes: Buffer): Promise<ExtractedRow[]> {
    return this.extractFromCsv(bytes.toString('utf-8'))
  }
}

let cachedExtractor: LlmExtractor | undefined

export function getLlmExtractor(): LlmExtractor {
  if (!cachedExtractor) {
    cachedExtractor = env.vertexAiProjectId
      ? new VertexGeminiExtractor(env.vertexAiProjectId, env.vertexAiLocation)
      : new FakeLlmExtractor()
  }
  return cachedExtractor
}
