// Every email/SMS Pepscore has actually sent about this invoice — the
// authoritative record, since Resend delivers through its own
// infrastructure rather than Google Workspace SMTP, so none of this ever
// appears in the admin@ Gmail Sent folder. Read-only; written exclusively
// by lib/notifications/log.ts at send time.
'use client'

import { useEffect, useState } from 'react'
import { card, mutedText, sectionHeading } from './theme'

type CommunicationStatus = 'SENT' | 'FAILED' | 'SKIPPED'
type CommunicationChannel = 'EMAIL' | 'SMS'

interface Communication {
  id: string
  channel: CommunicationChannel
  category: string
  status: CommunicationStatus
  fromAddress: string | null
  fromName: string | null
  replyTo: string | null
  toAddress: string
  subject: string | null
  body: string
  providerName: string | null
  providerMessageId: string | null
  failureReason: string | null
  actorType: string
  actorUserId: string | null
  sentAt: string
}

const STATUS_COLORS: Record<CommunicationStatus, string> = {
  SENT: 'border-gold/40 bg-gold/10 text-gold-light',
  FAILED: 'border-red-400/30 bg-red-400/10 text-red-300',
  SKIPPED: 'border-white/15 bg-white/5 text-white/50',
}

function formatCategory(category: string): string {
  return category.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

interface Props {
  invoiceId: string
}

export function CorrespondenceHistory({ invoiceId }: Props) {
  const [communications, setCommunications] = useState<Communication[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/invoices/${invoiceId}/communications`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setCommunications(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  if (loading) return null

  return (
    <div className={`${card} p-6 space-y-4`}>
      <h3 className={sectionHeading}>Correspondence History</h3>
      {communications.length === 0 ? (
        <p className={`text-sm ${mutedText}`}>No emails or texts have been sent about this invoice yet.</p>
      ) : (
        <div className="space-y-2">
          {communications.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 text-left"
                onClick={() => setExpandedId((v) => (v === c.id ? null : c.id))}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-heading font-bold uppercase tracking-[0.08em] text-white/40">
                      {c.channel}
                    </span>
                    <span className="text-sm font-medium text-white truncate">
                      {c.subject ?? formatCategory(c.category)}
                    </span>
                  </div>
                  <p className={`text-xs ${mutedText} truncate`}>
                    To {c.toAddress} — {new Date(c.sentAt).toLocaleString()}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${STATUS_COLORS[c.status]}`}>
                  {c.status}
                </span>
              </button>
              {expandedId === c.id ? (
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/60 space-y-1">
                  <p><span className={mutedText}>Category:</span> {formatCategory(c.category)}</p>
                  {c.fromAddress ? <p><span className={mutedText}>From:</span> {c.fromName ? `${c.fromName} <${c.fromAddress}>` : c.fromAddress}</p> : null}
                  {c.replyTo ? <p><span className={mutedText}>Reply-To:</span> {c.replyTo}</p> : null}
                  {c.providerName ? (
                    <p><span className={mutedText}>Provider:</span> {c.providerName}{c.providerMessageId ? ` — ${c.providerMessageId}` : ''}</p>
                  ) : null}
                  {c.failureReason ? <p className="text-red-300">Failure: {c.failureReason}</p> : null}
                  <p><span className={mutedText}>Triggered by:</span> {c.actorType === 'MANUAL' ? (c.actorUserId ?? 'Admin') : 'System'}</p>
                  {c.channel === 'EMAIL' ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gold-light">View sent content</summary>
                      <iframe
                        title={`Communication ${c.id} content`}
                        srcDoc={c.body}
                        className="mt-2 w-full h-64 rounded-lg border border-white/10 bg-white"
                        sandbox=""
                      />
                    </details>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/[0.03] p-2">{c.body}</p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
