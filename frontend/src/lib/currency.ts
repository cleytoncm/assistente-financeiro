const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formats a money value (always a decimal string from the API) as BRL currency, e.g. "R$ 1.234,56". */
export function formatCurrency(value: string | number): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  return formatter.format(numeric)
}
