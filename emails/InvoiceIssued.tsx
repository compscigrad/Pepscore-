// "Here's your invoice" email — sent once, automatically, the first time an
// invoice reaches ISSUED/PAID/PARTIALLY_PAID (see lib/invoices.ts), or
// manually anytime via the "Email Invoice to Customer" button. Same branding
// as emails/InvoiceShipmentUpdate.tsx; the full line-item/payment/tracking
// detail lives in the attached Client Invoice PDF, not duplicated here.
import { BILLING_EMAIL } from '@/lib/resend'

interface InvoiceIssuedProps {
  customerName: string
  invoiceNumber: string
  total: number
  amountPaid: number
  balanceDue: number
}

export function invoiceIssuedSubject(invoiceNumber: string): string {
  return `Your Invoice — #${invoiceNumber}`
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function buildInvoiceIssuedHtml({ customerName, invoiceNumber, total, amountPaid, balanceDue }: InvoiceIssuedProps): string {
  const year = new Date().getFullYear()
  const statusLine =
    balanceDue <= 0
      ? `<p style="margin:0;font-size:15px"><strong>Status:</strong> Paid in full</p>`
      : amountPaid > 0
        ? `<p style="margin:0;font-size:15px"><strong>Status:</strong> Partially paid — ${formatMoney(balanceDue)} remaining</p>`
        : `<p style="margin:0;font-size:15px"><strong>Status:</strong> Payment due</p>`

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Invoice</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🧾</div>
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">Your Invoice Is Ready</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">
        Hi ${customerName}, here's invoice <strong>${invoiceNumber}</strong>.
      </p>
      <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:left">
        <p style="margin:0 0 8px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:0.1em;font-family:Helvetica,sans-serif">Summary</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Total:</strong> ${formatMoney(total)}</p>
        ${statusLine}
      </div>
      <p style="color:#757575;font-size:13px;line-height:1.6">
        The full invoice — including itemized charges${balanceDue > 0 ? ', payment status,' : ''} and shipment tracking once available — is attached as a PDF.
      </p>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        Questions about this invoice? Reply to this message or contact ${BILLING_EMAIL}.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${BILLING_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}
