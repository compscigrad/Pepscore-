// Admin alert email — sent when a customer completes an intake link
// submission. Recipients are whoever is configured under Settings -> Admin
// Notifications with emailEnabled, never a hardcoded address.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { formatDateTimeForViewer } from '@/lib/dateFormat'

interface AdminIntakeNotificationProps {
  customerName: string
  invoiceNumber: string
  isNewCustomer: boolean
  possibleDuplicateOf?: string | null
  submittedAt: Date
}

export function adminIntakeNotificationSubject(customerName: string): string {
  return `New intake submitted — ${customerName}`
}

export function buildAdminIntakeNotificationHtml({
  customerName,
  invoiceNumber,
  isNewCustomer,
  possibleDuplicateOf,
  submittedAt,
}: AdminIntakeNotificationProps): string {
  const badge = isNewCustomer
    ? `<span style="background:${EMAIL_COLORS.gold};color:#000000;padding:4px 10px;border-radius:999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700">New Customer</span>`
    : `<span style="background:transparent;border:1px solid ${EMAIL_COLORS.borderStrong};color:${EMAIL_COLORS.textSecondary};padding:4px 10px;border-radius:999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase">Existing Customer</span>`
  const duplicateWarning = possibleDuplicateOf
    ? `<p style="margin:12px 0 0;font-size:13px;color:#F5A524">⚠ Possible duplicate customer — review before merging.</p>`
    : ''

  const detailsPanel = emailPanel(`
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Customer:</strong> ${escapeHtml(customerName)}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Draft Invoice:</strong> ${escapeHtml(invoiceNumber)}</p>
    <p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Submitted:</strong> ${formatDateTimeForViewer(submittedAt)}</p>
    ${duplicateWarning}
  `)

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px;text-align:center">New Intake Submitted</h2>
    <p style="margin:0 0 8px;text-align:center">${badge}</p>
    ${detailsPanel}
    <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;line-height:1.6;text-align:center">
      Open the draft invoice in the admin portal to review and finish fulfillment.
    </p>
  `

  return buildEmailShell({ eyebrow: 'Admin Notification', bodyHtml, footerNote: `This is an internal admin notification · ${ADMIN_EMAIL}` })
}
