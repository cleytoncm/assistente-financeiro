/**
 * Normalizes a description for exact-match category suggestion (RF-05): lowercase, accents
 * stripped, and whitespace collapsed/trimmed — so "Mercado  Extra" and "mercado extra" (or
 * "Mercadó Extra") are treated as the same description.
 */
export function normalizeDescription(description: string): string {
  return description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
