// AI-0B.4 -- Tier 2 (curated research corpus) and Tier 3 (approved primary
// literature) exist as architecture only during AI-0B, backed by a small,
// in-memory fixture list -- not a database table (owner instruction, item
// 18: pgvector is deferred, and AiSource/AiChunk should not be introduced
// merely to demonstrate the architecture). No automatic crawling, no bulk
// ingestion, no unrestricted web search.
import type { RetrievalAdapter, RetrievalQuery, RetrievedSource, SourceTier } from './types'

export interface FixtureSource {
  sourceId: string
  title: string
  sourceType: string
  tier: SourceTier
  url?: string
  publishedAt?: string
  content: string
}

// Deliberately empty -- no content has actually been curated/approved yet.
// A real Tier 2/3 corpus is populated (and, at that point, likely promoted
// to a real AiSource/AiChunk database table) as a later, separate,
// content-review decision, not part of AI-0B foundation.
export const TIER_2_3_FIXTURES: FixtureSource[] = []

// Naive substring relevance -- adequate only for the tiny, hand-curated
// fixture set this is designed for. Not a production retrieval algorithm;
// once the fixture list grows beyond a handful of entries or gets a real
// database table, this needs real ranking/embeddings, not before.
export class FixtureRetrieval implements RetrievalAdapter {
  constructor(
    readonly tier: 2 | 3,
    private readonly fixtures: FixtureSource[] = TIER_2_3_FIXTURES
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievedSource[]> {
    if (query.allowedTiers && !query.allowedTiers.includes(this.tier)) return []

    const q = query.text.toLowerCase()
    const matches = this.fixtures.filter((f) => f.tier === this.tier && f.content.toLowerCase().includes(q))
    const max = query.maxResults ?? 8
    const limited = matches.slice(0, max)

    return limited.map((f, i) => ({
      sourceId: f.sourceId,
      title: f.title,
      sourceType: f.sourceType,
      tier: f.tier,
      url: f.url,
      publishedAt: f.publishedAt,
      retrievalScore: limited.length > 1 ? 1 - i / limited.length : 1,
      citationLabel: `${f.sourceType}: ${f.title}`,
      content: f.content,
    }))
  }
}
