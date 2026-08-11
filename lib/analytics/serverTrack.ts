// Server-side event tracking -- for the funnel steps that only ever happen
// in a route handler or webhook (order paid, portal claimed, account
// created), where firing from the client would mean trusting the client to
// report its own success. Same safe-properties contract as
// lib/analytics/track.ts, and same best-effort-only behavior: a tracking
// failure must never affect the real operation (payment, portal claim,
// account creation) it's observing.
import { track } from '@vercel/analytics/server'
import type { AnalyticsEventName } from './events'

export type SafeEventProperties = Record<string, string | number | boolean | null>

export async function trackServerEvent(name: AnalyticsEventName, properties?: SafeEventProperties): Promise<void> {
  try {
    await track(name, properties)
  } catch {
    // Best-effort only -- see module comment.
  }
}
