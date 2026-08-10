// Failed-send visibility for the two portal-invite crons -- previously each
// cron's failures only existed in its raw JSON response (never seen, since
// nothing reads a Vercel cron invocation's response body) and, for the
// reminder cron only, a failed-count in an AdminAuditLog row with no admin
// UI reading it. Both crons now write an AdminAuditLog entry every run
// (ROLLOUT_CRON_RUN / REMINDER_CRON_RUN); this module is the read side.
import { prisma } from '@/lib/prisma'

export interface PortalDeliveryFailure {
  customerId: string
  error: string
}

export interface PortalDeliveryIssue {
  id: string
  cron: 'ROLLOUT' | 'REMINDER'
  occurredAt: Date
  failedCount: number
  failures: PortalDeliveryFailure[]
}

// A month of daily runs per cron -- generous enough to spot a pattern
// without the query growing unbounded.
const RECENT_RUN_LOOKBACK = 30

export async function getRecentPortalDeliveryIssues(): Promise<PortalDeliveryIssue[]> {
  const logs = await prisma.adminAuditLog.findMany({
    where: { action: { in: ['ROLLOUT_CRON_RUN', 'REMINDER_CRON_RUN'] } },
    orderBy: { createdAt: 'desc' },
    take: RECENT_RUN_LOOKBACK,
  })
  return logs.map(toIssue).filter((issue) => issue.failedCount > 0)
}

function toIssue(log: { id: string; action: string; createdAt: Date; details: unknown }): PortalDeliveryIssue {
  const details = (log.details ?? {}) as Record<string, unknown>
  const rawFailures = Array.isArray(details.failures) ? (details.failures as unknown[]) : []
  const failures: PortalDeliveryFailure[] = rawFailures
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => ({ customerId: String(f.customerId ?? ''), error: String(f.error ?? 'Unknown error') }))
    .filter((f) => f.customerId)
  return {
    id: log.id,
    cron: log.action === 'ROLLOUT_CRON_RUN' ? 'ROLLOUT' : 'REMINDER',
    occurredAt: log.createdAt,
    failedCount: typeof details.failed === 'number' ? details.failed : failures.length,
    failures,
  }
}

export interface RepeatedFailureSummary {
  customerId: string
  count: number
  lastError: string
}

// Pure aggregation: a single transient failure shouldn't read the same as
// a customer who fails on every run -- that repetition is the actual
// signal worth an admin's attention, not the raw per-run failure list.
// Deliberately keys "lastError" off each issue's own occurredAt rather than
// array order -- the caller's query orders newest-first, but this function
// must give the same correct answer regardless of what order it's handed.
export function summarizeRepeatedFailures(issues: PortalDeliveryIssue[]): RepeatedFailureSummary[] {
  const byCustomer = new Map<string, RepeatedFailureSummary & { lastOccurredAt: Date }>()
  for (const issue of issues) {
    for (const f of issue.failures) {
      const existing = byCustomer.get(f.customerId)
      const isNewer = !existing || issue.occurredAt >= existing.lastOccurredAt
      byCustomer.set(f.customerId, {
        customerId: f.customerId,
        count: (existing?.count ?? 0) + 1,
        lastError: isNewer ? f.error : existing.lastError,
        lastOccurredAt: isNewer ? issue.occurredAt : existing.lastOccurredAt,
      })
    }
  }
  return Array.from(byCustomer.values())
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map(({ customerId, count, lastError }) => ({ customerId, count, lastError }))
}
