// Client-facing emails for the two possible outcomes of an admin reviewing a
// payment-arrangement request (Sections 20/21).
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

interface ArrangementApprovedProps {
  customerName: string
  invoiceNumber: string
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  frequency: string
  downPayment: number
  installmentCount: number
  scheduleSummary: string
}

export function arrangementApprovedSubject(invoiceNumber: string): string {
  return `Your Payment Arrangement Was Approved — Invoice #${invoiceNumber}`
}

export function buildArrangementApprovedHtml(props: ArrangementApprovedProps): string {
  const summaryPanel = emailPanel(`
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Invoice Total:</strong> ${formatMoney(props.invoiceTotal)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Current Balance Due:</strong> ${formatMoney(props.balanceDue)}</p>
    <p style="margin:10px 0 0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Approved Frequency:</strong> ${escapeHtml(props.frequency)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Approved Immediate Payment:</strong> ${formatMoney(props.downPayment)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Approved Installments:</strong> ${props.installmentCount}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Approved Schedule:</strong> ${escapeHtml(props.scheduleSummary)}</p>
    <p style="margin:10px 0 0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Invoice Status:</strong> Pending</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Payment Status:</strong> ${escapeHtml(props.paymentStatus)}</p>
  `)

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Your Payment Arrangement Was Approved</h2>
    <p style="font-size:15px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      Hi ${escapeHtml(props.customerName)}, your payment-arrangement request for invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong> has been approved.
    </p>
    ${summaryPanel}
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      Payments will be recorded after they are manually verified.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Payment Arrangement', bodyHtml, footerNote: `Questions? Reply to this message or contact ${BILLING_EMAIL}.` })
}

interface ArrangementDeniedProps {
  customerName: string
  invoiceNumber: string
  reason: string | null
  secureLink: string
  paymentStatus: string
  balanceDue: number
}

export function arrangementDeniedSubject(invoiceNumber: string): string {
  return `Update on Your Payment Arrangement Request — Invoice #${invoiceNumber}`
}

export function buildArrangementDeniedHtml(props: ArrangementDeniedProps): string {
  const reasonPanel = props.reason
    ? emailPanel(`<p style="margin:0;font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Note from Pepscore Lab:</strong><br/>${escapeHtml(props.reason)}</p>`)
    : ''

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Update on Your Payment Arrangement Request</h2>
    <p style="font-size:15px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      Hi ${escapeHtml(props.customerName)}, your payment-arrangement request for invoice <strong>#${escapeHtml(props.invoiceNumber)}</strong> was not approved as submitted.
    </p>
    ${reasonPanel}
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      Please use your secure client link to choose Pay in Full, or submit a revised payment-arrangement request.
    </p>
    ${emailCta(props.secureLink, 'Review Invoice')}
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      Invoice Status: Pending · Payment Status: ${escapeHtml(props.paymentStatus)} · Current Balance Due: ${formatMoney(props.balanceDue)}
    </p>
  `
  return buildEmailShell({ eyebrow: 'Payment Arrangement', bodyHtml, footerNote: `Questions? Reply to this message or contact ${BILLING_EMAIL}.` })
}
