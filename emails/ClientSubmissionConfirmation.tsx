// Short client-facing confirmations for the two possible second-submission
// actions — Sections 11 and 15 both call for "the client receives a
// confirmation email" separately from the admin alert. Deliberately brief:
// the substantive detail (amounts, schedule) already went to the admin, and
// the client's own invoice page (the same secure link) always has the
// current state — this just confirms the click registered.
import { BILLING_EMAIL } from '@/lib/resend'

function shell(bodyHtml: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
    </div>
    <div style="padding:32px 36px;text-align:center">${bodyHtml}</div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${BILLING_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}

export function paymentSelectionConfirmationSubject(invoiceNumber: string): string {
  return `We Received Your Payment Selection — Invoice #${invoiceNumber}`
}

export function buildPaymentSelectionConfirmationHtml(customerName: string, invoiceNumber: string): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 10px">Thanks, ${customerName}!</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      We received your Pay in Full selection for invoice <strong>#${invoiceNumber}</strong>. Our team will manually
      verify your payment and follow up shortly — this confirmation does not mean payment has been received yet.
    </p>
  `)
}

export function arrangementRequestReceivedSubject(invoiceNumber: string): string {
  return `We Received Your Payment Arrangement Request — Invoice #${invoiceNumber}`
}

export function buildArrangementRequestReceivedHtml(customerName: string, invoiceNumber: string): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 10px">Thanks, ${customerName}!</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      We received your payment-arrangement request for invoice <strong>#${invoiceNumber}</strong>. It's now awaiting
      review — we'll email you as soon as it's been approved or if we need to follow up.
    </p>
  `)
}
