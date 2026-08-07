// Reconciles the authoritative RUO price table (an external spreadsheet,
// supplied out-of-band -- never committed to this repo) against the
// production Product catalog. Read-only by default: reports matched rows,
// unmatched sheet rows (new products/strengths), unmatched DB products, and
// ambiguous mappings, so an admin can review the checkpoint before any
// catalog-wide write.
//
// Pass --seed-suggested to additionally write supplierCaseCost and the
// three suggested* prices for MATCHED rows only (lib/pricing/service.ts's
// recalculateSuggestedPricing) -- never touches active* pricing, never
// touches unmatched/ambiguous rows, never creates or deletes a Product.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/import-pricing-catalog.ts --file "<path to .xlsx>" [--seed-suggested]
import * as XLSX from 'xlsx'
import { prisma } from '../lib/prisma'
import { matchCatalogRows } from '../lib/pricing/catalogImport'
import type { PriceTableRow } from '../lib/pricing/catalogImport'
import { recalculateSuggestedPricing } from '../lib/pricing/service'

interface RawRow {
  Product: string
  Strength: string
  'Supplier Cost': number
  'Case (10 Vials)': number
  SPA: number
  'Individual (1 Vial)': number
}

function parsePriceTable(filePath: string): PriceTableRow[] {
  const wb = XLSX.readFile(filePath)
  const sheetName = wb.SheetNames.find((n) => /price table/i.test(n)) ?? wb.SheetNames[0]
  const raw = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[sheetName], { defval: null })
  return raw
    .filter((r) => r.Product && r.Strength)
    .map((r) => ({
      product: String(r.Product),
      strength: String(r.Strength),
      supplierCost: Number(r['Supplier Cost']),
      caseStandardPrice: Number(r['Case (10 Vials)']),
      spaPrice: Number(r.SPA),
      individualVialPrice: Number(r['Individual (1 Vial)']),
    }))
}

async function main() {
  const fileArgIdx = process.argv.indexOf('--file')
  if (fileArgIdx === -1 || !process.argv[fileArgIdx + 1]) {
    console.error('Usage: --file "<path to .xlsx>" [--seed-suggested]')
    process.exit(1)
  }
  const filePath = process.argv[fileArgIdx + 1]
  const seedSuggested = process.argv.includes('--seed-suggested')

  const rows = parsePriceTable(filePath)
  const products = await prisma.product.findMany({ select: { id: true, name: true, size: true } })
  const result = matchCatalogRows(rows, products)

  if (seedSuggested) {
    for (const m of result.matched) {
      await recalculateSuggestedPricing(m.product.id, m.row.supplierCost)
    }
  }

  console.log(JSON.stringify({
    mode: seedSuggested ? 'APPLIED (suggested* pricing + supplierCaseCost only -- active pricing untouched)' : 'DRY RUN -- report only, no writes',
    totalSheetRows: rows.length,
    totalCatalogProducts: products.length,
    matchedCount: result.matched.length,
    unmatchedSheetRowsCount: result.unmatchedSheetRows.length,
    unmatchedSheetRows: result.unmatchedSheetRows.map((r) => `${r.product} — ${r.strength}`),
    unmatchedProductsCount: result.unmatchedProducts.length,
    unmatchedProducts: result.unmatchedProducts.map((p) => `${p.name} — ${p.size}`),
    ambiguousCount: result.ambiguous.length,
    ambiguous: result.ambiguous.map((a) => ({ row: `${a.row.product} — ${a.row.strength}`, candidateIds: a.candidates.map((c) => c.id) })),
  }, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
