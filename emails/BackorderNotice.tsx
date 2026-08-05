// Customer-facing emails for the backorder workflow: the initial notice
// (sent when an item is marked backordered) and the refund-completed
// confirmation (sent only once an admin actually completes a pending
// refund — never at request time). Same plain-HTML-string pattern as
// emails/ClientSubmissionConfirmation.tsx. Wording is deliberately literal
// about what has and hasn't happened yet — a pending refund is described as
// "being processed," never as "refunded," per the no-false-completion rule.
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

  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      One item on your order, <strong>${props.productName}</strong>, is temporarily on backorder. Your order status
      remains <strong>Preparing</strong> — we'll move it forward the moment this item is back in stock, and everything
      else on your order is unaffected.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">${dateLine}</p>
    ${props.compensationLines.length > 0 ? `
    <div style="background:#F5F5F0;border-radius:10px;padding:18px 20px;margin:18px 0;font-size:13px;line-height:1.8;color:#424242">
      ${props.compensationLines.map((line) => `<p style="margin:0 0 8px">${line}</p>`).join('')}
    </div>` : ''}
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Thank you for your patience — reach out anytime at ${BILLING_EMAIL} with questions about Invoice
      #${props.invoiceNumber}.
    </p>
  `)
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
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Your refund of <strong>${formatMoney(props.amount)}</strong> for Invoice
      <strong>#${props.invoiceNumber}</strong> has been completed${props.method ? ` via ${props.method}` : ''}.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Please allow your bank or payment provider a few business days to reflect it, depending on the method used.
      Reach out anytime at ${BILLING_EMAIL} with questions.
    </p>
  `)
}
