// Customer-facing emails for the standalone (non-backorder) refund/credit
// workflow — sent at request time, before anything has actually happened.
// Same plain-HTML-string pattern and shell as emails/BackorderNotice.tsx.
// The completion confirmation is deliberately NOT duplicated here:
// emails/BackorderNotice.tsx's refundCompletedSubject/buildRefundCompletedHtml
// is already fully generic (no backorder-specific wording) and is reused
// as-is by lib/backorders.ts's completeRefund() for both origins.
import { BILLING_EMAIL } from '@/lib/resend'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shell(bodyHtml: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
    </div>
    <div style="padding:32px 36px">${bodyHtml}</div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${BILLING_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
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
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      We've received a refund request of <strong>${formatMoney(props.requestedAmount)}</strong> for Invoice
      <strong>#${props.invoiceNumber}</strong> (${props.reason}). This refund is now <strong>pending</strong> — we'll
      send a separate confirmation once it's actually been completed.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `)
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
// credit Pepscore grants directly, not money returned through an external
// provider) — so this is a completed-state notice, not a pending one.
export function buildAccountCreditIssuedHtml(props: AccountCreditIssuedProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      A credit of <strong>${formatMoney(props.amount)}</strong> has been added to your account (${props.reason}),
      related to Invoice <strong>#${props.invoiceNumber}</strong>. You can apply it toward a future order.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `)
}
