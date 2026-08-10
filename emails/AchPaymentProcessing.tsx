// [Roadmap] ACH (Phase 2) -- customer notification for the "submitted, not
// yet confirmed" moment in the ACH lifecycle. Deliberately never uses the
// word "confirmed" or "paid" -- that's what buildOrderConfirmationHtml
// (sent later, once checkout.session.async_payment_succeeded actually
// fires) is for.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { ORDERS_EMAIL } from '@/lib/resend'
import { buildEmailShell, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface AchPaymentProcessingProps {
  orderNumber: string
  customerName: string
  total: number
  bankName?: string | null
  bankAccountLast4?: string | null
}

export function achPaymentProcessingSubject(orderNumber: string): string {
  return `Payment Processing — Order ${orderNumber} | Pepscore Lab`
}

export function buildAchPaymentProcessingHtml(props: AchPaymentProcessingProps): string {
  const { orderNumber, customerName, total, bankName, bankAccountLast4 } = props
  const bankLine = bankName && bankAccountLast4 ? `${escapeHtml(bankName)} ••••${escapeHtml(bankAccountLast4)}` : 'your bank account'

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Your Payment Is Processing</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6">
      Thanks, ${escapeHtml(customerName)}. We've submitted your $${total.toFixed(2)} bank payment for order <strong>${escapeHtml(orderNumber)}</strong> from ${bankLine}.
    </p>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.6">
      Bank payments (ACH) typically take a few business days to clear. We'll email you again as soon as your bank confirms the payment — your order won't ship until then.
    </p>
  `

  return buildEmailShell({
    eyebrow: 'Payment Update',
    bodyHtml,
    footerNote: `Questions about this payment? Reply to this email or contact ${ORDERS_EMAIL}.`,
  })
}
