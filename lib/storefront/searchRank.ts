// Pure, DB-free storefront search ranking (Phase 2B item 7 correction,
// 2026-08-07). No I/O here -- lib/storefront/search.ts is the thin wrapper
// that fetches the active catalog and calls into this.
//
// Priority order, strongest first -- a query only ever falls through to a
// weaker tier when every stronger tier produced zero matches:
//   1. Exact product-name match
//   2. Exact product-name + strength match
//   3. Exact alias/synonym match (admin-editable Product.searchSynonyms,
//      one product's synonyms, never shared across products)
//   4. Normalized-formatting exact match (case/punctuation/whitespace
//      insensitive, e.g. "glow-70" / "GLOW 70" / "glow70" all hit GLOW70)
//   5. Prefix/token substring match (today's pre-existing behavior)
//   6. Typo/fuzzy match -- ONLY reached when nothing above matched at all
//
// Product-identity protection: because every stronger tier is tried first
// and short-circuits the moment it produces a result, a query that is
// itself an exact (or near-exact/token) hit for a real product NEVER
// reaches the fuzzy tier -- so "KLOW" can never be reinterpreted as
// "GLOW70" merely because the two names are one character apart; a search
// for the literal string "KLOW" always resolves via tier 1 before fuzzy
// logic ever runs. Fuzzy matching itself is scored per-candidate against
// that candidate's own real name (never a merged/blended identity), and
// when two distinct real products tie for the closest fuzzy match, both
// are returned rather than the algorithm silently guessing one.
import type { Product } from '@prisma/client'

export type SearchableProduct = Pick<Product, 'id' | 'name' | 'size' | 'category' | 'searchSynonyms'>

export type MatchTier = 'EXACT_NAME' | 'EXACT_NAME_STRENGTH' | 'EXACT_ALIAS' | 'NORMALIZED' | 'PREFIX_TOKEN' | 'FUZZY'

export interface RankedMatch<T extends SearchableProduct> {
  product: T
  tier: MatchTier
}

function normalizeExact(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Strips whitespace/punctuation/hyphens/underscores down to nothing (not
// just collapsing them) so "GLOW-70", "GLOW 70", and "GLOW70" all
// normalize to the identical string "glow70" for tier 4 -- deliberately
// more aggressive than normalizeExact(), which only tiers 1-3 use and
// which preserves word boundaries.
function normalizeFormatting(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function synonymList(searchSynonyms: string | null): string[] {
  return (searchSynonyms ?? '')
    .split(',')
    .map((s) => normalizeExact(s))
    .filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(
        row[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      )
    }
    prev = row
  }
  return prev[b.length]
}

// Length-scaled typo tolerance. The real product-identity safeguard is
// structural, not this threshold: every exact/alias/normalized/token tier
// above always runs first and short-circuits the moment it matches, so a
// direct query for "KLOW" or "GLOW70" never reaches fuzzy scoring at all
// regardless of how loose this threshold is. This only governs how much a
// genuine misspelling (of a query that matched nothing stronger) may
// differ from a real name -- and even here, the closest-match-only /
// return-ties-as-separate-results rule below means a query that happens to
// sit near two distinct real names always surfaces both rather than
// silently picking one.
function fuzzyThreshold(len: number): number {
  if (len <= 3) return 1
  if (len <= 9) return 2
  return 3
}

export function rankSearch<T extends SearchableProduct>(query: string, products: T[]): RankedMatch<T>[] {
  const q = query.trim()
  if (!q || products.length === 0) return []

  const qExact = normalizeExact(q)
  const qFormatted = normalizeFormatting(q)
  const tokens = q.split(/\s+/).filter(Boolean).map((t) => t.toLowerCase())

  // Tier 1
  const exactName = products.filter((p) => normalizeExact(p.name) === qExact)
  if (exactName.length > 0) return exactName.map((product) => ({ product, tier: 'EXACT_NAME' as const }))

  // Tier 2
  const exactNameStrength = products.filter((p) => normalizeExact(`${p.name} ${p.size}`) === qExact)
  if (exactNameStrength.length > 0) return exactNameStrength.map((product) => ({ product, tier: 'EXACT_NAME_STRENGTH' as const }))

  // Tier 3 — each product's synonyms are its own; never shared/matched
  // across a different product's name.
  const exactAlias = products.filter((p) => synonymList(p.searchSynonyms).includes(qExact))
  if (exactAlias.length > 0) return exactAlias.map((product) => ({ product, tier: 'EXACT_ALIAS' as const }))

  // Tier 4
  const normalized = products.filter(
    (p) => normalizeFormatting(p.name) === qFormatted || normalizeFormatting(`${p.name} ${p.size}`) === qFormatted
  )
  if (normalized.length > 0) return normalized.map((product) => ({ product, tier: 'NORMALIZED' as const }))

  // Tier 5 — every token must match at least one field (AND across tokens,
  // OR within a token's candidates), same rule the prior substring-only
  // implementation used.
  const tokenMatches = products.filter((p) =>
    tokens.every((token) => {
      const synonyms = p.searchSynonyms?.toLowerCase() ?? ''
      return (
        p.name.toLowerCase().includes(token) ||
        p.size.toLowerCase().includes(token) ||
        p.category.toLowerCase().includes(token) ||
        synonyms.includes(token)
      )
    })
  )
  if (tokenMatches.length > 0) return tokenMatches.map((product) => ({ product, tier: 'PREFIX_TOKEN' as const }))

  // Tier 6 — only reached when nothing above matched. Scored independently
  // per candidate against its own name/name+strength; only the closest
  // candidate(s) survive, and a genuine tie between two distinct products
  // returns both rather than picking one.
  const threshold = fuzzyThreshold(qFormatted.length)
  const scored = products
    .map((p) => {
      const distance = Math.min(
        levenshtein(qFormatted, normalizeFormatting(p.name)),
        levenshtein(qFormatted, normalizeFormatting(`${p.name} ${p.size}`))
      )
      return { product: p, distance }
    })
    .filter((s) => s.distance <= threshold)

  if (scored.length === 0) return []
  const minDistance = Math.min(...scored.map((s) => s.distance))
  return scored.filter((s) => s.distance === minDistance).map(({ product }) => ({ product, tier: 'FUZZY' as const }))
}
