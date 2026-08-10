// "We received your payment" email — sent once per payment recorded on an
// invoice (lib/invoices.ts's recordPayment() calls this after every
// InvoicePayment is created, so unlike the one-time invoice-issued email,
// no dedup guard is needed here: each call already corresponds to exactly
// one real payment event). Same branding pattern as InvoiceIssued.tsx.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface PaymentReceivedProps {
  customerName: string
  invoiceNumber: string
  amountPaid: number
  balanceDue: number
  total: number
}

export function paymentReceivedSubject(invoiceNumber: string): string {
  return `Payment Received — Invoice #${invoiceNumber}`
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function buildPaymentReceivedHtml({ customerName, invoiceNumber, amountPaid, balanceDue, total }: PaymentReceivedProps): string {
  const statusLine =
    balanceDue <= 0
      ? `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Status:</strong> Paid in full — thank you!</p>`
      : `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Status:</strong> ${formatMoney(balanceDue)} remaining</p>`

  const summaryPanel = emailPanel(`
    <p style="margin:0 0 8px;font-size:11px;color:${EMAIL_COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em">Summary</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Amount Paid:</strong> ${formatMoney(amountPaid)}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Invoice Total:</strong> ${formatMoney(total)}</p>
    ${statusLine}
  `)

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Payment Received</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6;margin:0">
      Hi ${escapeHtml(customerName)}, we've received your payment for invoice <strong>${escapeHtml(invoiceNumber)}</strong>.
    </p>
    ${summaryPanel}
    <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;line-height:1.6">
      The full payment history is available on the attached invoice PDF.
    </p>
  `

  return buildEmailShell({
    eyebrow: 'Payment Received',
    bodyHtml,
    footerNote: `Questions about this payment? Reply to this email or contact ${BILLING_EMAIL}.`,
  })
}
