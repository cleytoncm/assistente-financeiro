import { formatCurrency } from '../lib/currency'

/**
 * Same output as formatCurrency, but with the NBSP between "R$" and the digits collapsed to a
 * regular space. Testing Library's getByText/findByText normalize the rendered DOM text (which
 * collapses that NBSP) but do NOT normalize the search string, so plain-text assertions must
 * build their expected string with this helper instead of formatCurrency directly.
 *
 * Does NOT apply to getByRole's accessible-name matching (e.g. button names) — that computation
 * preserves the NBSP as-is, so those assertions must use formatCurrency directly instead.
 */
export function money(value: string | number): string {
  return formatCurrency(value).replace(/ /g, ' ')
}
