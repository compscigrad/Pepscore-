// Short client-facing confirmations for the two possible second-submission
// actions — Sections 11 and 15 both call for "the client receives a
// confirmation email" separately from the admin alert. Deliberately brief:
// the substantive detail (amounts, schedule) already went to the admin, and
// the client's own invoice page (the same secure link) always has the
// current state — this just confirms the click registered.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { buildEmailShell, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { BILLING_EMAIL } from '@/lib/resend'

export function paymentSelectionConfirmationSubject(invoiceNumber: string): string {
  return `We Received Your Payment Selection — Invoice #${invoiceNumber}`
}

export function buildPaymentSelectionConfirmationHtml(customerName: string, invoiceNumber: string): string {
  const bodyHtml = `
    <h2 style="font-size:18px;color:${EMAIL_COLORS.textPrimary};margin:0 0 10px">Thanks, ${escapeHtml(customerName)}!</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      We received your Pay in Full selection for invoice <strong>#${escapeHtml(invoiceNumber)}</strong>. Our team will manually
      verify your payment and follow up shortly — this confirmation does not mean payment has been received yet.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Payment Selection Received', bodyHtml, footerNote: `Questions? Reply to this message or contact ${BILLING_EMAIL}.` })
}

export function arrangementRequestReceivedSubject(invoiceNumber: string): string {
  return `We Received Your Payment Arrangement Request — Invoice #${invoiceNumber}`
}

export function buildArrangementRequestReceivedHtml(customerName: string, invoiceNumber: string): string {
  const bodyHtml = `
    <h2 style="font-size:18px;color:${EMAIL_COLORS.textPrimary};margin:0 0 10px">Thanks, ${escapeHtml(customerName)}!</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      We received your payment-arrangement request for invoice <strong>#${escapeHtml(invoiceNumber)}</strong>. It's now awaiting
      review — we'll email you as soon as it's been approved or if we need to follow up.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Arrangement Request Received', bodyHtml, footerNote: `Questions? Reply to this message or contact ${BILLING_EMAIL}.` })
}
