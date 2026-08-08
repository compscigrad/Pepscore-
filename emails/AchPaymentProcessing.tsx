// [Roadmap] ACH (Phase 2) -- customer notification for the "submitted, not
// yet confirmed" moment in the ACH lifecycle. Deliberately never uses the
// word "confirmed" or "paid" -- that's what buildOrderConfirmationHtml
// (sent later, once checkout.session.async_payment_succeeded actually
// fires) is for. Same plain-HTML-string, same light cream/gold shell as
// its sibling OrderConfirmation.tsx for consistency with the email it's
// sent alongside -- both predate the dark "Pepscore Lab" brand correction
// applied elsewhere this session; rebranding emails/** is a separate,
// already-noted gap, not something this template should fix in isolation.
import { ORDERS_EMAIL } from '@/lib/resend'

interface AchPaymentProcessingProps {
  orderNumber: string
  customerName: string
  total: number
  bankName?: string | null
  bankAccountLast4?: string | null
}

export function achPaymentProcessingSubject(orderNumber: string): string {
  return `Payment Processing — Order ${orderNumber} | Pepscore`
}

export function buildAchPaymentProcessingHtml(props: AchPaymentProcessingProps): string {
  const { orderNumber, customerName, total, bankName, bankAccountLast4 } = props
  const year = new Date().getFullYear()
  const bankLine = bankName && bankAccountLast4 ? `${bankName} ••••${bankAccountLast4}` : 'your bank account'

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Holistic Research Peptides</p>
    </div>
    <div style="padding:36px 36px 28px">
      <h2 style="font-family:Helvetica,sans-serif;font-size:20px;color:#1A1A1A;margin-bottom:8px">Your Payment Is Processing</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">
        Thanks, ${customerName}. We've submitted your $${total.toFixed(2)} bank payment for order <strong>${orderNumber}</strong> from ${bankLine}.
      </p>
      <p style="color:#424242;font-size:14px;line-height:1.6">
        Bank payments (ACH) typically take a few business days to clear. We'll email you again as soon as your bank confirms the payment — your order won't ship until then.
      </p>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        Questions about this payment? Reply to this email or contact ${ORDERS_EMAIL}.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${ORDERS_EMAIL} · For research purposes only.</p>
    </div>
  </div>
</body>
</html>`
}
