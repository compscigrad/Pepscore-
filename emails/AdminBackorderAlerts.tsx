// Admin-facing alert fired when a backorder compensation creates a pending
// refund obligation that requires manual processing (no online-payment
// provider is integrated, so nothing completes itself). Same shell pattern
// as emails/AdminPaymentAlerts.tsx.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

interface RefundActionRequiredProps {
  invoiceNumber: string
  invoiceId: string
  refundId: string
  clientName: string
  refundAmount: number
  reason: string
  appUrl: string
}

export function backorderFinancialActionRequiredSubject(invoiceNumber: string): string {
  return `Manual Refund Required — Invoice #${invoiceNumber}`
}

export function buildBackorderFinancialActionRequiredHtml(props: RefundActionRequiredProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Manual Refund Required</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      A backorder compensation on Invoice <strong style="color:${EMAIL_COLORS.textPrimary}">#${escapeHtml(props.invoiceNumber)}</strong> (${escapeHtml(props.clientName)}) requires a
      real refund of <strong style="color:${EMAIL_COLORS.textPrimary}">${formatMoney(props.refundAmount)}</strong> — this invoice was already paid, so the
      compensation could not be applied as a discount.
    </p>
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      No money has been returned yet. Pepscore Lab has no automated refund provider, so this refund is recorded as
      <strong>Pending</strong> until you process it manually (e.g. through your payment terminal or bank) and mark it
      complete from the invoice page. The customer has not been told a refund is complete.
    </p>
    ${emailPanel(`<p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Reason:</strong> ${escapeHtml(props.reason)}</p>`)}
    ${emailCta(adminLink, 'Open Invoice & Process Refund')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}

// Same alert, generic wording — for a refund requested directly (not via a
// backorder compensation). Kept as a separate pair rather than reusing
// backorderFinancialActionRequiredSubject/Html so the backorder path's exact
// wording and behavior stay untouched.
export function refundActionRequiredSubject(invoiceNumber: string): string {
  return `Manual Refund Required — Invoice #${invoiceNumber}`
}

export function buildRefundActionRequiredHtml(props: RefundActionRequiredProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Manual Refund Required</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      A refund of <strong style="color:${EMAIL_COLORS.textPrimary}">${formatMoney(props.refundAmount)}</strong> was requested on Invoice
      <strong style="color:${EMAIL_COLORS.textPrimary}">#${escapeHtml(props.invoiceNumber)}</strong> (${escapeHtml(props.clientName)}).
    </p>
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      No money has been returned yet. Pepscore Lab has no automated refund provider, so this refund is recorded as
      <strong>Pending</strong> until you process it manually (e.g. through your payment terminal or bank) and mark it
      complete from the invoice page. The customer has not been told a refund is complete.
    </p>
    ${emailPanel(`<p style="margin:0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Reason:</strong> ${escapeHtml(props.reason)}</p>`)}
    ${emailCta(adminLink, 'Open Invoice & Process Refund')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}

// A portal customer requested an email-address change — never applied
// automatically (see lib/portal/profile.ts's requestEmailChange), an admin
// must review and apply it via the customer's admin profile page.
interface ProfileEmailChangeRequestedProps {
  customerName: string
  customerId: string
  currentEmail: string | null
  requestedEmail: string
  appUrl: string
}

export function profileEmailChangeRequestedSubject(): string {
  return `Customer Requested an Email Change`
}

export function buildProfileEmailChangeRequestedHtml(props: ProfileEmailChangeRequestedProps): string {
  const adminLink = `${props.appUrl}/admin/customers/${props.customerId}`
  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Email Change Requested</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      <strong style="color:${EMAIL_COLORS.textPrimary}">${escapeHtml(props.customerName)}</strong> requested to change their portal account email from
      <strong style="color:${EMAIL_COLORS.textPrimary}">${props.currentEmail ? escapeHtml(props.currentEmail) : '(none on file)'}</strong> to <strong style="color:${EMAIL_COLORS.textPrimary}">${escapeHtml(props.requestedEmail)}</strong>.
    </p>
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      This has not been changed automatically. Verify the request is genuine before updating it on the customer's
      profile — changing this email changes what a future portal login must match to claim or re-claim this account.
    </p>
    ${emailCta(adminLink, 'Review Customer')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}
