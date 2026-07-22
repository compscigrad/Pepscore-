// "We received your payment" email — sent once per payment recorded on an
// invoice (lib/invoices.ts's recordPayment() calls this after every
// InvoicePayment is created, so unlike the one-time invoice-issued email,
// no dedup guard is needed here: each call already corresponds to exactly
// one real payment event). Same branding pattern as InvoiceIssued.tsx.
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
  const year = new Date().getFullYear()
  const statusLine =
    balanceDue <= 0
      ? `<p style="margin:0;font-size:15px"><strong>Status:</strong> Paid in full — thank you!</p>`
      : `<p style="margin:0;font-size:15px"><strong>Status:</strong> ${formatMoney(balanceDue)} remaining</p>`

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Payment Received</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">Payment Received</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">
        Hi ${customerName}, we've received your payment for invoice <strong>${invoiceNumber}</strong>.
      </p>
      <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:left">
        <p style="margin:0 0 8px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:0.1em;font-family:Helvetica,sans-serif">Summary</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Amount Paid:</strong> ${formatMoney(amountPaid)}</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Invoice Total:</strong> ${formatMoney(total)}</p>
        ${statusLine}
      </div>
      <p style="color:#757575;font-size:13px;line-height:1.6">
        The full payment history is available on the attached invoice PDF.
      </p>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        Questions about this payment? Reply to this message or contact contact@pepscore.com.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · contact@pepscore.com</p>
    </div>
  </div>
</body>
</html>`
}
