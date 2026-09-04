// Admin-facing alerts fired the moment a client submits a Pay in Full
// selection (Section 12) or a payment-arrangement request (Section 16).
// Both explicitly state that nothing has been confirmed as received yet,
// matching the spec's suggested wording verbatim in substance.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { formatDateTimeForViewer } from '@/lib/dateFormat'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

interface PaymentSelectionPendingProps {
  invoiceNumber: string
  invoiceId: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  selectedMethod: string
  submittedAt: Date
  appUrl: string
}

export function paymentSelectionPendingSubject(invoiceNumber: string): string {
  return `Payment Selection Pending — Invoice #${invoiceNumber}`
}

export function buildPaymentSelectionPendingHtml(props: PaymentSelectionPendingProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  const detailsPanel = emailPanel(`
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Client:</strong> ${escapeHtml(props.clientName)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Phone:</strong> ${props.clientPhone ? escapeHtml(props.clientPhone) : '—'}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Email:</strong> ${props.clientEmail ? escapeHtml(props.clientEmail) : '—'}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Selected Method:</strong> ${escapeHtml(props.selectedMethod)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Invoice Total:</strong> ${formatMoney(props.invoiceTotal)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Remaining Balance:</strong> ${formatMoney(props.balanceDue)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Submitted:</strong> ${formatDateTimeForViewer(props.submittedAt)}</p>
  `)

  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Payment Selection Pending</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      The client has submitted a Pay in Full payment selection for Invoice <strong style="color:${EMAIL_COLORS.textPrimary}">#${escapeHtml(props.invoiceNumber)}</strong>.
      The invoice has automatically changed to <strong style="color:${EMAIL_COLORS.textPrimary}">Pending</strong>.
    </p>
    ${detailsPanel}
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      This invoice is awaiting manual payment verification. No additional payment has been recorded or confirmed by
      this submission.
    </p>
    ${emailCta(adminLink, 'Open Invoice')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}

interface ArrangementRequestPendingProps {
  invoiceNumber: string
  invoiceId: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  frequency: string
  proposedDownPayment: number
  installmentCount: number
  scheduleSummary: string
  submittedAt: Date
  appUrl: string
}

export function arrangementRequestPendingSubject(invoiceNumber: string): string {
  return `Payment Arrangement Approval Required — Invoice #${invoiceNumber}`
}

export function buildArrangementRequestPendingHtml(props: ArrangementRequestPendingProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  const detailsPanel = emailPanel(`
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Client:</strong> ${escapeHtml(props.clientName)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Phone:</strong> ${props.clientPhone ? escapeHtml(props.clientPhone) : '—'}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Email:</strong> ${props.clientEmail ? escapeHtml(props.clientEmail) : '—'}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Invoice Status:</strong> Pending</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Payment Status:</strong> ${escapeHtml(props.paymentStatus)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Current Balance Due:</strong> ${formatMoney(props.balanceDue)}</p>
    <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Requested Frequency:</strong> ${escapeHtml(props.frequency)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Proposed Immediate Payment:</strong> ${formatMoney(props.proposedDownPayment)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Proposed Installments:</strong> ${props.installmentCount}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Proposed Schedule:</strong> ${escapeHtml(props.scheduleSummary)}</p>
    <p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Submitted:</strong> ${formatDateTimeForViewer(props.submittedAt)}</p>
  `)

  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">Payment Arrangement Approval Required</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      The client has requested a payment arrangement for Invoice <strong style="color:${EMAIL_COLORS.textPrimary}">#${escapeHtml(props.invoiceNumber)}</strong>.
    </p>
    ${detailsPanel}
    <p style="font-size:13px;color:${EMAIL_COLORS.textMuted};line-height:1.6">
      This request has not been approved, and no proposed payment has been recorded as received.
    </p>
    ${emailCta(adminLink, 'Review & Approve or Deny')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}
