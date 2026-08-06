// Admin-facing read layer over the CustomerAccessEvent audit trail (Auth
// Sprint P3) — a pure aggregating query, no parallel business logic. Every
// call is scoped by the caller's own customerId, same pattern as
// lib/portal/dashboard.ts's getPortalDashboardData().
import { prisma } from '@/lib/prisma'
import type { CustomerAccessEvent } from '@prisma/client'

const RECENT_EVENT_LIMIT = 15
// How far back "recent" failed-webhook warnings look — old failures aren't
// actionable and shouldn't keep flashing a warning banner indefinitely.
const FAILED_WEBHOOK_LOOKBACK_DAYS = 30

export interface CustomerAccessSummary {
  lastSignInAt: Date | null
  lastSessionActivityAt: Date | null
  lastLogoutAt: Date | null
  lastRevokedAt: Date | null
  // Best-effort only: a count of SESSION_CREATED events with no later
  // SESSION_ENDED/REMOVED/REVOKED for the same clerkSessionId in our audit
  // trail. Not authoritative — Clerk doesn't expose a live session list via
  // webhooks, and a missed/delayed webhook delivery can overcount. Treat as
  // an approximation, not a security control.
  approximateActiveSessionCount: number
  recentEvents: CustomerAccessEvent[]
  recentFailedWebhookCount: number
}

export async function getCustomerAccessSummary(customerId: string): Promise<CustomerAccessSummary> {
  const events = await prisma.customerAccessEvent.findMany({
    where: { customerId },
    orderBy: { eventTimestamp: 'desc' },
    take: 200, // enough history for the approximate-session-count reconciliation below without unbounded growth
  })

  const lastSignInAt = events.find((e) => e.eventType === 'SESSION_CREATED')?.eventTimestamp ?? null
  const lastSessionActivityAt = events.find((e) => e.eventType.startsWith('SESSION_'))?.eventTimestamp ?? null
  const lastLogoutAt = events.find((e) => e.eventType === 'SESSION_ENDED' || e.eventType === 'SESSION_REMOVED')?.eventTimestamp ?? null
  const lastRevokedAt = events.find((e) => e.eventType === 'SESSION_REVOKED')?.eventTimestamp ?? null

  const closedSessionIds = new Set(
    events.filter((e) => e.eventType === 'SESSION_ENDED' || e.eventType === 'SESSION_REMOVED' || e.eventType === 'SESSION_REVOKED').map((e) => e.clerkSessionId)
  )
  const seenOpenSessionIds = new Set<string>()
  for (const e of events) {
    if (e.eventType === 'SESSION_CREATED' && e.clerkSessionId && !closedSessionIds.has(e.clerkSessionId)) {
      seenOpenSessionIds.add(e.clerkSessionId)
    }
  }

  const since = new Date(Date.now() - FAILED_WEBHOOK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const recentFailedWebhookCount = await prisma.customerAccessEvent.count({
    where: { customerId, processingStatus: 'FAILED', createdAt: { gte: since } },
  })

  return {
    lastSignInAt,
    lastSessionActivityAt,
    lastLogoutAt,
    lastRevokedAt,
    approximateActiveSessionCount: seenOpenSessionIds.size,
    recentEvents: events.slice(0, RECENT_EVENT_LIMIT),
    recentFailedWebhookCount,
  }
}
