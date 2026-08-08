// Pure helper for listInvoices()'s "search by amount" support -- a bare
// number like "150" or "150.00" also matches an exact total/balanceDue.
// Extracted so the parsing rule (which strings count as an amount vs. a
// customer name/invoice number) is unit-testable without a database.
export function parseAmountSearchTerm(search: string): number | null {
  const trimmed = search.trim()
  return /^\d+(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : null
}
