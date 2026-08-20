// Customer account closure emails (2026-08-20). Customer confirmation is
// transactional, not marketing -- sent regardless of marketing-email
// opt-out status (closure confirmation is not a nurture/acquisition send,
// same distinction lib/notifications/routing.ts already draws for every
// other transactional category).
import { ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

export interface AccountClosedProps {
  firstName: string
}

export function accountClosedSubject(): string {
  return 'Your Pepscore Lab Account Has Been Closed'
}

export function buildAccountClosedHtml(props: AccountClosedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.firstName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your Pepscore Lab account has been closed at your request. No further action is needed to complete this.
    </p>
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      Historical transaction records may be retained in accordance with applicable business and record-keeping
      requirements. This does not affect any communication preferences you've already set.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      If this was accidental or you need assistance, reach out at ${ADMIN_EMAIL}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Account Closed', bodyHtml, footerNote: `Questions? Contact ${ADMIN_EMAIL}.` })
}

export interface AccountClosureAlertProps {
  customerName: string
  customerId: string
  email: string | null
  closedAt: Date
  openInvoiceCount: number
  activeAuthorizationCount: number
  proEligible: boolean
  customerProfileUrl: string
}

export function accountClosureAlertSubject(props: { customerName: string }): string {
  return `Account Closed — ${props.customerName}`
}

export function buildAccountClosureAlertHtml(props: AccountClosureAlertProps): string {
  const detailsPanel = emailPanel(`
    <p style="margin:0"><strong style="color:${EMAIL_COLORS.textPrimary}">Customer:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.customerName)}${props.email ? ` (${escapeHtml(props.email)})` : ''}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Closed:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.closedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Open invoices:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.openInvoiceCount}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Active Preferred Pricing authorizations:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.activeAuthorizationCount}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Professional Access:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.proEligible ? 'Active' : 'Not active'}</span></p>
  `)

  const bodyHtml = `
    <h2 style="font-size:18px;margin:0 0 14px;color:${EMAIL_COLORS.textPrimary};text-align:center">Customer account closed (informational)</h2>
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted};text-align:center;margin:0 0 14px">This is not an approval request — the account is already closed. Review for any needed post-closure follow-up.</p>
    ${detailsPanel}
    <p style="text-align:center;margin-top:16px"><a href="${props.customerProfileUrl}" style="color:${EMAIL_COLORS.textPrimary};text-decoration:underline">Open Customer Profile →</a></p>
  `

  return buildEmailShell({ eyebrow: 'Admin Notification', bodyHtml, footerNote: 'Review open items from the customer profile.' })
}
