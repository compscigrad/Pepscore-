// Admin Professional Access review queue + early-launch invite workflow
// (2026-08-19 Professional Access sprint, sections 11-12). One client
// component covers both -- they're the two ways a customer ends up with
// Professional Access, and an admin working this queue benefits from
// seeing both in one place rather than two disconnected pages.
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline, pillSecondary, input } from '@/components/invoices/theme'

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUESTED' | 'REVOKED'

interface ApplicationRow {
  id: string
  contactName: string
  businessName: string
  businessEmail: string
  phone: string | null
  website: string | null
  businessType: string | null
  jurisdiction: string | null
  registrationInfo: string | null
  purposeDescription: string | null
  expectedVolume: string | null
  status: ApplicationStatus
  reviewNotes: string | null
  createdAt: string
  customer: { id: string; firstName: string; lastName: string; email: string | null; proEligible: boolean; status: string } | null
}

interface InviteRow {
  id: string
  email: string
  status: 'PENDING' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  customer: { id: string; firstName: string; lastName: string; email: string | null } | null
}

const STATUS_TABS: { value: ApplicationStatus | 'ALL'; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'MORE_INFO_REQUESTED', label: 'More Info Requested' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'REVOKED', label: 'Revoked' },
  { value: 'ALL', label: 'All' },
]

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  PENDING: 'bg-amber-400/15 text-amber-300',
  APPROVED: 'bg-green-500/15 text-green-400',
  REJECTED: 'bg-red-500/15 text-red-400',
  MORE_INFO_REQUESTED: 'bg-blue-500/15 text-blue-300',
  REVOKED: 'bg-white/10 text-white/50',
}

export function ProfessionalAccessQueue() {
  const [tab, setTab] = useState<ApplicationStatus | 'ALL'>('PENDING')
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notesByApp, setNotesByApp] = useState<Record<string, string>>({})
  const [busyAppId, setBusyAppId] = useState<string | null>(null)

  const [invites, setInvites] = useState<InviteRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const loadApplications = useCallback(async () => {
    try {
      const qs = tab === 'ALL' ? '' : `?status=${tab}`
      const res = await fetch(`/api/admin/professional-access${qs}`)
      if (res.ok) setApplications((await res.json()).applications)
    } finally {
      setLoading(false)
    }
  }, [tab])

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/professional-access/invites')
      if (res.ok) setInvites((await res.json()).invites)
    } finally {
      // Empty finally -- matches loadApplications' try/finally shape so
      // this async effect-triggered load follows the same established
      // pattern as every other admin "load on mount" component in this
      // codebase (see e.g. PortalAccessSection.tsx's refresh()).
    }
  }, [])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  async function review(id: string, action: 'approve' | 'reject' | 'request_more_info' | 'revoke') {
    setBusyAppId(id)
    try {
      const res = await fetch(`/api/admin/professional-access/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notesByApp[id] || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update application')
      toast.success(
        action === 'approve' ? 'Professional Access granted' : action === 'reject' ? 'Application rejected' : action === 'revoke' ? 'Professional Access revoked' : 'More information requested'
      )
      await loadApplications()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update application')
    } finally {
      setBusyAppId(null)
    }
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) {
      toast.error('Enter an email address')
      return
    }
    setInviteBusy(true)
    try {
      const res = await fetch('/api/admin/professional-access/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invitation')
      toast.success('Invitation sent')
      setInviteEmail('')
      await loadInvites()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviteBusy(false)
    }
  }

  async function inviteAction(id: string, action: 'resend' | 'revoke') {
    try {
      const res = await fetch(`/api/admin/professional-access/invites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update invitation')
      toast.success(action === 'resend' ? 'Reminder sent' : 'Invitation revoked')
      await loadInvites()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update invitation')
    }
  }

  return (
    <div className="space-y-8">
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className={sectionHeading}>Applications</h3>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${
                  tab === t.value ? pillPrimary : pillOutline
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className={mutedText}>Loading…</p>
        ) : applications.length === 0 ? (
          <p className={`${mutedText} text-center py-8`}>No applications in this view.</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div key={app.id} className="border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-heading font-bold text-white">{app.businessName}</p>
                    <p className="text-[13px] text-white/60">{app.contactName} · {app.businessEmail}{app.phone ? ` · ${app.phone}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE[app.status]}`}>
                    {app.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px] mb-3">
                  {app.website && (<div><dt className="text-white/40">Website</dt><dd className="text-white/80">{app.website}</dd></div>)}
                  {app.businessType && (<div><dt className="text-white/40">Type</dt><dd className="text-white/80">{app.businessType}</dd></div>)}
                  {app.jurisdiction && (<div><dt className="text-white/40">Jurisdiction</dt><dd className="text-white/80">{app.jurisdiction}</dd></div>)}
                  {app.expectedVolume && (<div><dt className="text-white/40">Expected Volume</dt><dd className="text-white/80">{app.expectedVolume}</dd></div>)}
                  {app.registrationInfo && (<div><dt className="text-white/40">Registration</dt><dd className="text-white/80">{app.registrationInfo}</dd></div>)}
                  {app.customer && (<div><dt className="text-white/40">Entitlement</dt><dd className="text-white/80">{app.customer.proEligible ? 'Active' : 'Not active'}</dd></div>)}
                </dl>
                {app.purposeDescription && <p className="text-[13px] text-white/70 mb-3 whitespace-pre-line">{app.purposeDescription}</p>}
                {app.reviewNotes && <p className="text-[12px] text-white/40 mb-3">Review notes: {app.reviewNotes}</p>}

                <input
                  className={`${input} mb-2 text-[12px]`}
                  placeholder="Notes (shown to applicant for reject/more-info)"
                  value={notesByApp[app.id] ?? ''}
                  onChange={(e) => setNotesByApp((prev) => ({ ...prev, [app.id]: e.target.value }))}
                />
                <div className="flex gap-2 flex-wrap">
                  {app.status !== 'APPROVED' && (
                    <button onClick={() => review(app.id, 'approve')} disabled={busyAppId === app.id} className={`${pillPrimary} px-3 py-1.5 text-[11px]`}>
                      Approve
                    </button>
                  )}
                  {app.status !== 'REJECTED' && (
                    <button onClick={() => review(app.id, 'reject')} disabled={busyAppId === app.id} className={`${pillOutline} px-3 py-1.5 text-[11px]`}>
                      Reject
                    </button>
                  )}
                  {app.status !== 'MORE_INFO_REQUESTED' && (
                    <button onClick={() => review(app.id, 'request_more_info')} disabled={busyAppId === app.id} className={`${pillSecondary} px-3 py-1.5 text-[11px]`}>
                      Request More Info
                    </button>
                  )}
                  {app.status === 'APPROVED' && (
                    <button onClick={() => review(app.id, 'revoke')} disabled={busyAppId === app.id} className="px-3 py-1.5 text-[11px] rounded-full border border-red-400/40 text-red-300 hover:bg-red-400/10">
                      Revoke Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${card} p-6`}>
        <h3 className={sectionHeading}>Early-Launch Invitations</h3>
        <p className={`${mutedText} mb-4`}>
          Invite a known Professional customer directly — accepting the invitation activates Professional Access immediately, no separate application review.
        </p>
        <div className="flex gap-2 mb-4">
          <input
            className={`${input} flex-1`}
            type="email"
            placeholder="customer@business.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button onClick={sendInvite} disabled={inviteBusy} className={`${pillPrimary} px-4 py-2 whitespace-nowrap`}>
            {inviteBusy ? 'Sending…' : 'Send Invite'}
          </button>
        </div>

        {invites.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left border-b border-white/10 text-white/50">
                  <th className="pb-2 font-heading text-[10px] font-bold tracking-[0.06em] uppercase">Email</th>
                  <th className="pb-2 font-heading text-[10px] font-bold tracking-[0.06em] uppercase">Status</th>
                  <th className="pb-2 font-heading text-[10px] font-bold tracking-[0.06em] uppercase">Expires</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5">
                    <td className="py-2 text-white/80">{inv.email}</td>
                    <td className="py-2 text-white/60">{inv.status}</td>
                    <td className="py-2 text-white/40">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {inv.status === 'SENT' && (
                        <>
                          <button onClick={() => inviteAction(inv.id, 'resend')} className="text-[#D4AF37] hover:underline mr-3">Resend</button>
                          <button onClick={() => inviteAction(inv.id, 'revoke')} className="text-red-300 hover:underline">Revoke</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
