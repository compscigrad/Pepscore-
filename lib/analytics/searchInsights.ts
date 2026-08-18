// AI-1.1 -- read-side aggregation over SearchEvent, backing the admin
// "search-demand analysis" / "zero-result search insights" capability
// (owner-approved AI-1 direction, item 14 — internal admin intelligence
// using first-party data, no LLM call needed for this first slice: these
// are plain aggregation queries, not AI-generated summaries). Never
// fabricates data -- both functions return an empty array when there's
// insufficient event history, not a guessed/plausible-looking result.
//
// Aggregation logic is split into pure functions (below) so it's directly
// unit-testable; the DB-fetching wrappers follow this repo's established
// convention of not being independently re-tested against a live database
// (see lib/invoice/numbering.test.ts's precedent).
import { prisma } from '@/lib/prisma'

export interface ZeroResultQuery {
  query: string
  count: number
  lastSearchedAt: Date
}

export interface TopQuery {
  query: string
  count: number
}

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function aggregateZeroResultQueries(events: { query: string; createdAt: Date }[], limit = 25): ZeroResultQuery[] {
  const byQuery = new Map<string, { count: number; lastSearchedAt: Date }>()
  for (const e of events) {
    const key = e.query.trim().toLowerCase()
    if (!key) continue
    const existing = byQuery.get(key)
    if (existing) {
      existing.count += 1
      if (e.createdAt > existing.lastSearchedAt) existing.lastSearchedAt = e.createdAt
    } else {
      byQuery.set(key, { count: 1, lastSearchedAt: e.createdAt })
    }
  }

  return [...byQuery.entries()]
    .map(([query, v]) => ({ query, count: v.count, lastSearchedAt: v.lastSearchedAt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function aggregateTopQueries(events: { query: string }[], limit = 25): TopQuery[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    const key = e.query.trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// Queries that returned zero results, most frequent first -- the direct
// "what are researchers looking for that we don't carry" signal.
export async function getZeroResultQueries(days: number, limit = 25): Promise<ZeroResultQuery[]> {
  const events = await prisma.searchEvent.findMany({
    where: { resultCount: 0, createdAt: { gte: windowStart(days) } },
    select: { query: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return aggregateZeroResultQueries(events, limit)
}

// Most frequent searches overall (any result count) -- demand signal for
// merchandising/catalog prioritization.
export async function getTopSearchQueries(days: number, limit = 25): Promise<TopQuery[]> {
  const events = await prisma.searchEvent.findMany({
    where: { createdAt: { gte: windowStart(days) } },
    select: { query: true },
  })
  return aggregateTopQueries(events, limit)
}
