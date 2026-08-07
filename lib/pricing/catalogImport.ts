// Pure matching logic for reconciling the authoritative RUO price table
// (an external spreadsheet) against the production Product catalog. No I/O
// here -- scripts/import-pricing-catalog.ts is the thin wrapper that reads
// the file and the DB and calls into this.
export interface PriceTableRow {
  product: string
  strength: string
  supplierCost: number
  caseStandardPrice: number
  spaPrice: number
  individualVialPrice: number
}

export interface CatalogProductCandidate {
  id: string
  name: string
  size: string
}

export interface CatalogMatch {
  row: PriceTableRow
  product: CatalogProductCandidate
}

export interface CatalogMatchResult {
  matched: CatalogMatch[]
  // Sheet rows with no corresponding Product row -- a new product/strength
  // that must be created, never silently guessed into an existing one.
  unmatchedSheetRows: PriceTableRow[]
  // Product rows with no corresponding sheet row -- catalog entries the
  // price table doesn't cover; left entirely untouched by an import.
  unmatchedProducts: CatalogProductCandidate[]
  // More than one Product row normalizes to the same product+strength key
  // -- never resolved automatically, always routed to admin review (same
  // "never guess" principle as findPossibleDuplicateCustomers).
  ambiguous: Array<{ row: PriceTableRow; candidates: CatalogProductCandidate[] }>
}

export function normalizeProductName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeStrength(strength: string): string {
  return strength.trim().toLowerCase().replace(/\s+/g, '')
}

function matchKey(name: string, strength: string): string {
  return `${normalizeProductName(name)}::${normalizeStrength(strength)}`
}

export function matchCatalogRows(rows: PriceTableRow[], products: CatalogProductCandidate[]): CatalogMatchResult {
  const productsByKey = new Map<string, CatalogProductCandidate[]>()
  for (const p of products) {
    const key = matchKey(p.name, p.size)
    if (!productsByKey.has(key)) productsByKey.set(key, [])
    productsByKey.get(key)!.push(p)
  }

  const matched: CatalogMatch[] = []
  const unmatchedSheetRows: PriceTableRow[] = []
  const ambiguous: Array<{ row: PriceTableRow; candidates: CatalogProductCandidate[] }> = []
  const matchedProductIds = new Set<string>()

  for (const row of rows) {
    const key = matchKey(row.product, row.strength)
    const candidates = productsByKey.get(key) ?? []
    if (candidates.length === 0) {
      unmatchedSheetRows.push(row)
    } else if (candidates.length === 1) {
      matched.push({ row, product: candidates[0] })
      matchedProductIds.add(candidates[0].id)
    } else {
      ambiguous.push({ row, candidates })
    }
  }

  const unmatchedProducts = products.filter((p) => !matchedProductIds.has(p.id))

  return { matched, unmatchedSheetRows, ambiguous, unmatchedProducts }
}
