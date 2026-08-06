// Admin controls for the customer portal identity/invitation lifecycle —
// invite, resend, revoke, disable/enable access, and unlink/repair an
// identity link. Calls the PR1 backend (app/api/admin/customers/[id]/
// portal-invite/route.ts); this is the UI for it. Claim/login audit
// history is the existing Activity Timeline section on this same page —
// PORTAL_INVITE_GENERATED/PORTAL_ACCOUNT_CLAIMED/PORTAL_ACCESS_DISABLED/
// PORTAL_ACCESS_ENABLED/PORTAL_IDENTITY_UNLINKED all already log there via
// recordCustomerActivity(), so nothing new is needed to surface them.
'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { card, mutedText, sectionHeading, pillPrimary, pillOutline } from '@/components/invoices/theme'

interface PortalInviteStatus {
  linked: boolean
  portalAccessDisabled: boolean
  activeInvite: { id: string; token: string; expiresAt: string; createdAt: string } | null
}

export function PortalAccessSection({ customerId, hasEmail }: { customerId: string; hasEmail: boolean }) {
  const [status, setStatus] = useState<PortalInviteStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/portal-invite`)
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function invite() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/portal-invite`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invitation')
      toast.success('Invitation sent')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setSubmitting(false)
    }
  }

  async function action(body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/portal-invite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update portal access')
      toast.success(successMessage)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update portal access')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !status) return null

  return (
    <div className={`${card} p-6 space-y-3`}>
      <h3 className={sectionHeading}>Portal Access</h3>

      {!hasEmail ? (
        <p className={`text-sm ${mutedText}`}>This customer has no email on file — an email is required before inviting portal access.</p>
      ) : status.linked ? (
        <div className="space-y-2">
          <p className="text-sm text-white">
            {status.portalAccessDisabled ? (
              <span className="text-red-300 font-medium">Access disabled</span>
            ) : (
              <span className="text-gold-light font-medium">Account claimed and active</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {status.portalAccessDisabled ? (
              <button type="button" className={`${pillPrimary} px-4 py-2`} disabled={submitting} onClick={() => action({ action: 'enable' }, 'Portal access enabled')}>
                Enable Access
              </button>
            ) : (
              <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => action({ action: 'disable' }, 'Portal access disabled')}>
                Disable Access
              </button>
            )}
            <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => action({ action: 'unlink' }, 'Identity unlinked — customer can be re-invited')}>
              Unlink Identity
            </button>
          </div>
        </div>
      ) : status.activeInvite ? (
        <div className="space-y-2">
          <p className={`text-sm ${mutedText}`}>
            Invitation sent, not yet claimed — expires {new Date(status.activeInvite.expiresAt).toLocaleDateString()}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => action({ action: 'resend' }, 'Invitation resent')}>
              Resend
            </button>
            <button type="button" className={`${pillOutline} px-4 py-2`} disabled={submitting} onClick={() => action({ action: 'revoke' }, 'Invitation revoked')}>
              Revoke
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className={`text-sm ${mutedText}`}>No portal account set up yet.</p>
          <button type="button" className={`${pillPrimary} px-5 py-2`} disabled={submitting} onClick={invite}>
            Invite to Portal
          </button>
        </div>
      )}
    </div>
  )
}
