// Customer-facing emails for the backorder workflow: the initial notice
// (sent when an item is marked backordered), the resolved notice, the
// accommodation notice, and the refund-completed confirmation (sent only
// once an admin actually completes a pending refund — never at request
// time; reused as-is by lib/backorders.ts's completeRefund() for both
// backorder-originated and standalone refunds). Wording is deliberately
// literal about what has and hasn't happened yet — a pending refund is
// described as "being processed," never as "refunded," per the
// no-false-completion rule.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export interface BackorderNoticeProps {
  customerName: string
  invoiceNumber: string
  productName: string
  expectedAvailableDate: Date | null
  // Pre-composed, accurate sentences describing exactly what financial
  // action was taken (credit applied / refund pending / account credit
  // issued) — built by the caller (lib/backorders.ts), which has the actual
  // disposition amounts; this template never guesses or summarizes on its own.
  compensationLines: string[]
}

export function backorderNoticeSubject(invoiceNumber: string): string {
  return `An Update on Your Order — Invoice #${invoiceNumber}`
}

export function buildBackorderNoticeHtml(props: BackorderNoticeProps): string {
  const dateLine = props.expectedAvailableDate
    ? `We currently expect it to be available around <strong>${props.expectedAvailableDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.`
    : `We'll share an expected availability date as soon as we have one.`

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      One item on your order, <strong>${escapeHtml(props.productName)}</strong>, is temporarily on backorder. Your order status
      remains <strong>Preparing</strong> — we'll move it forward the moment this item is back in stock, and everything
      else on your order is unaffected.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">${dateLine}</p>
    ${props.compensationLines.length > 0 ? emailPanel(props.compensationLines.map((line) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}">${line}</p>`).join('')) : ''}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Thank you for your patience — reach out anytime at ${BILLING_EMAIL} with questions about Invoice
      #${escapeHtml(props.invoiceNumber)}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Order Update', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}

export interface BackorderResolvedProps {
  customerName: string
  invoiceNumber: string
  productName: string
}

export function backorderResolvedSubject(invoiceNumber: string): string {
  return `Your Backordered Item Is Available — Invoice #${invoiceNumber}`
}

export function buildBackorderResolvedHtml(props: BackorderResolvedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Good news — <strong>${escapeHtml(props.productName)}</strong> on your order (Invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong>)
      is no longer on backorder. We're moving your order forward now.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      You'll get a separate tracking update once it ships. Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Order Update', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}

export interface BackorderAccommodationProps {
  customerName: string
  invoiceNumber: string
  accommodationAmount: number
  revisedBalanceDue: number
  reason: string
  portalUrl: string | null
}

export function backorderAccommodationSubject(invoiceNumber: string): string {
  return `Your Invoice Has Been Updated — Invoice #${invoiceNumber}`
}

// Never includes the admin's internal reason verbatim in customer-facing
// copy -- only that an accommodation was applied and what it changed.
export function buildBackorderAccommodationHtml(props: BackorderAccommodationProps): string {
  const summaryPanel = emailPanel(`
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Backorder Accommodation:</strong> -${formatMoney(props.accommodationAmount)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Revised Balance Due:</strong> ${formatMoney(props.revisedBalanceDue)}</p>
  `)

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your Pepscore Lab invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong> has been updated to include a backorder
      accommodation.
    </p>
    ${summaryPanel}
    ${props.portalUrl ? `<p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">Your revised balance is available in your <a href="${props.portalUrl}" style="color:${EMAIL_COLORS.gold}">Customer Portal</a>.</p>` : ''}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${BILLING_EMAIL} with questions about Invoice #${escapeHtml(props.invoiceNumber)}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Invoice Updated', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}

export interface RefundCompletedProps {
  customerName: string
  invoiceNumber: string
  amount: number
  method: string | null
}

export function refundCompletedSubject(invoiceNumber: string): string {
  return `Your Refund Has Been Completed — Invoice #${invoiceNumber}`
}

export function buildRefundCompletedHtml(props: RefundCompletedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your refund of <strong>${formatMoney(props.amount)}</strong> for Invoice
      <strong>#${escapeHtml(props.invoiceNumber)}</strong> has been completed${props.method ? ` via ${escapeHtml(props.method)}` : ''}.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Please allow your bank or payment provider a few business days to reflect it, depending on the method used.
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Refund Completed', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}
