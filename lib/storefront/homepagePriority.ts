// Homepage merchandising priority (owner-directed, 2026-08-12 homepage
// refresh sprint) -- reorders the already-grouped/featured-sorted product
// list so specific franchises lead the homepage grid, without touching
// groupByName's own featured-first logic for anything outside these tiers.
// Tier membership is by real Product.name, matched against the live
// catalog -- never a fabricated product. A tier with zero matching
// products in the live catalog is simply skipped, not padded.
import type { ProductCardProps } from '@/components/storefront/ProductCard'

const PRIORITY_TIERS: string[][] = [
  // 1. GLP-1 family (agonists, analogs, amylin, and their combinations)
  ['Semaglutide', 'Tirzepatide', 'Retatrutide', 'Survodutide', 'Mazdutide', 'Cagrilintide', 'Cagrilintide 2.5mg + Semaglutide 2.5mg', 'Cagrilintide 5mg + Semaglutide 5mg'],
  // 2. NAD+
  ['NAD+'],
  // 3. CJC products / Ipamorelin, per the authoritative catalog's real
  // product names. Order matters here (2026-08-12 merchandising fix):
  // Ipamorelin leads, the CJC-Ipamorelin-without-DAC blend immediately
  // follows it, then the remaining CJC-1295 variants -- previously this
  // blend product wasn't listed in any priority tier at all, so it fell
  // through to unordered DB-creation-date order and landed next to KLOW
  // by coincidence, not by design.
  ['Ipamorelin', 'CJC-1295 without DAC 5mg + Ipamorelin 5mg', 'CJC-1295 No DAC', 'CJC-1295 With DAC'],
  // 4. GLOW70
  ['GLOW70'],
  // 5. Tesamorelin
  ['Tesamorelin'],
  // 6. Botulinum toxin -- not currently a live catalog product; tier
  // intentionally left in place (no-op today) rather than removed, so it
  // takes effect automatically if the product is ever added.
  ['Botulinum Toxin', 'Botox'],
]

export function applyHomepagePriority(products: ProductCardProps[]): ProductCardProps[] {
  const byName = new Map(products.map((p) => [p.name.toLowerCase(), p]))
  const used = new Set<string>()
  const ordered: ProductCardProps[] = []

  for (const tier of PRIORITY_TIERS) {
    for (const name of tier) {
      const key = name.toLowerCase()
      const product = byName.get(key)
      if (product && !used.has(key)) {
        ordered.push(product)
        used.add(key)
      }
    }
  }

  for (const product of products) {
    if (!used.has(product.name.toLowerCase())) ordered.push(product)
  }

  return ordered
}
