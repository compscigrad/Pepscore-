// Admin-facing login/session audit history (Auth Sprint P3) — reads
// /api/admin/customers/[id]/access-history, sourced from the
// CustomerAccessEvent audit trail plus a best-effort live Clerk lookup.
// Read-only: all portal-access controls (invite/disable/unlink) stay in
// PortalAccessSection, this is purely visibility.
'use client'

import { useEffect, useState } from 'react'
import { card, mutedText, sectionHeading, divider } from '@/components/invoices/theme'

interface AccessEvent {
  id: string
  eventType: string
  eventTimestamp: string
  outcome: string | null
  deviceType: string | null
  browserName: string | null
  city: string | null
  country: string | null
  processingStatus: string
}

interface AccessHistoryResponse {
  summary: {
    lastSignInAt: string | null
    lastSessionActivityAt: string | null
    lastLogoutAt: string | null
    lastRevokedAt: string | null
    approximateActiveSessionCount: number
    recentEvents: AccessEvent[]
    recentFailedWebhookCount: number
  }
  live: {
    emailVerified: boolean | null
    mfaEnabled: boolean
    banned: boolean
    locked: boolean
  } | null
}

const EVENT_LABELS: Record<string, string> = {
  USER_CREATED: 'Account created',
  USER_UPDATED: 'Account updated',
  USER_DELETED: 'Account deleted (Clerk)',
  SESSION_CREATED: 'Signed in',
  SESSION_ENDED: 'Signed out',
  SESSION_REMOVED: 'Session removed',
  SESSION_REVOKED: 'Session revoked',
  EMAIL_CREATED: 'Email sent by Clerk',
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never recorded'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function AccessHistorySection({ customerId }: { customerId: string }) {
  const [data, setData] = useState<AccessHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/customers/${customerId}/access-history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (loading) return null
  if (!data) return null

  const { summary, live } = data

  return (
    <div className={`${card} p-6 space-y-4`}>
      <h3 className={sectionHeading}>Access History</h3>

      {summary.recentFailedWebhookCount > 0 ? (
        <div className="bg-red-400/10 border border-red-400/30 rounded-lg p-3">
          <p className="text-sm text-red-300">
            {summary.recentFailedWebhookCount} webhook event{summary.recentFailedWebhookCount === 1 ? '' : 's'} failed to process in the last 30 days.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Last Sign-In</p>
          <p className="text-white">{formatDateTime(summary.lastSignInAt)}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Last Session Activity</p>
          <p className="text-white">{formatDateTime(summary.lastSessionActivityAt)}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Last Sign-Out</p>
          <p className="text-white">{formatDateTime(summary.lastLogoutAt)}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Last Revoked</p>
          <p className="text-white">{formatDateTime(summary.lastRevokedAt)}</p>
        </div>
        <div>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Approx. Active Sessions</p>
          <p className="text-white">
            {summary.approximateActiveSessionCount}
            <span className={`text-xs ${mutedText}`}> (best-effort, from webhook history)</span>
          </p>
        </div>
        {live ? (
          <div>
            <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Live Clerk Status</p>
            <p className="text-white">
              {live.emailVerified === null ? 'Email unknown' : live.emailVerified ? 'Email verified' : 'Email not verified'}
              {' · '}
              {live.mfaEnabled ? 'MFA on' : 'MFA off'}
              {live.banned ? ' · Banned' : ''}
              {live.locked ? ' · Locked' : ''}
            </p>
          </div>
        ) : null}
      </div>

      {summary.recentEvents.length > 0 ? (
        <div className={`border-t ${divider} pt-3 space-y-2`}>
          <p className={`text-xs uppercase tracking-[0.08em] ${mutedText}`}>Recent Events</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {summary.recentEvents.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-white/80">
                  {EVENT_LABELS[e.eventType] ?? e.eventType}
                  {e.processingStatus === 'FAILED' ? <span className="text-red-300"> (failed)</span> : null}
                  {e.city || e.country ? <span className={mutedText}> — {[e.city, e.country].filter(Boolean).join(', ')}</span> : null}
                </span>
                <span className={`text-xs shrink-0 ${mutedText}`}>{formatDateTime(e.eventTimestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={`text-sm ${mutedText}`}>No login activity recorded yet.</p>
      )}
    </div>
  )
}
