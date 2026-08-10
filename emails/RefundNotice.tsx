// Customer-facing emails for the standalone (non-backorder) refund/credit
// workflow — sent at request time, before anything has actually happened.
// The completion confirmation is deliberately NOT duplicated here:
// emails/BackorderNotice.tsx's refundCompletedSubject/buildRefundCompletedHtml
// is already fully generic (no backorder-specific wording) and is reused
// as-is by lib/backorders.ts's completeRefund() for both origins.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export interface RefundRequestedProps {
  customerName: string
  invoiceNumber: string
  requestedAmount: number
  reason: string
}

export function refundRequestedSubject(invoiceNumber: string): string {
  return `Refund Requested — Invoice #${invoiceNumber}`
}

// Deliberately says "requested" and "pending," never "refunded" — no money
// has moved yet. Matches the no-false-completion rule that governs every
// refund-related template in this codebase.
export function buildRefundRequestedHtml(props: RefundRequestedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      We've received a refund request of <strong>${formatMoney(props.requestedAmount)}</strong> for Invoice
      <strong>#${escapeHtml(props.invoiceNumber)}</strong> (${escapeHtml(props.reason)}). This refund is now <strong>pending</strong> — we'll
      send a separate confirmation once it's actually been completed.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Refund Requested', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}

export interface AccountCreditIssuedProps {
  customerName: string
  invoiceNumber: string
  amount: number
  reason: string
}

export function accountCreditIssuedSubject(invoiceNumber: string): string {
  return `Account Credit Issued — Invoice #${invoiceNumber}`
}

// Account credit, unlike a cash refund, is issued immediately (it's store
// credit Pepscore Lab grants directly, not money returned through an
// external provider) — so this is a completed-state notice, not a pending one.
export function buildAccountCreditIssuedHtml(props: AccountCreditIssuedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      A credit of <strong>${formatMoney(props.amount)}</strong> has been added to your account (${escapeHtml(props.reason)}),
      related to Invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong>. You can apply it toward a future order.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Account Credit', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}
