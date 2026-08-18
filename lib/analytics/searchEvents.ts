// AI-1.1 -- writes to SearchEvent. Follows the same convention as every
// other audit-log write in this codebase (not independently DB-tested in
// the fast unit suite; see lib/invoice/numbering.test.ts's precedent).
//
// Called once per full /search page view, never per keystroke -- the
// existing predictive combobox stays exactly as fast as it already is.
// Wrapped so a logging failure can never break the actual search results
// page rendering (same "must never break a real customer action"
// philosophy as lib/analytics/track.ts's trackEvent()).
import { prisma } from '@/lib/prisma'

export async function logSearchEvent(query: string, resultCount: number): Promise<void> {
  try {
    await prisma.searchEvent.create({ data: { query, resultCount } })
  } catch {
    // Best-effort only.
  }
}
