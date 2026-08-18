// AI-0B.4 -- the citation/source schema (prior scope review section 8).
// Deliberately a thin projection of RetrievedSource, not a new database
// model -- see tier23Fixtures.ts's header for why Tier 2/3 storage itself
// stays in-memory during AI-0B.
import type { RetrievedSource } from '../retrieval/types'

export interface Citation {
  sourceId: string
  citationLabel: string
  tier: number
  sourceType: string
  url?: string
}

export function toCitation(source: RetrievedSource): Citation {
  return {
    sourceId: source.sourceId,
    citationLabel: source.citationLabel,
    tier: source.tier,
    sourceType: source.sourceType,
    url: source.url,
  }
}

export function deduplicateCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>()
  return citations.filter((c) => {
    if (seen.has(c.sourceId)) return false
    seen.add(c.sourceId)
    return true
  })
}
