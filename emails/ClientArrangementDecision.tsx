// Client-facing emails for the two possible outcomes of an admin reviewing a
// payment-arrangement request (Sections 20/21). Same plain-HTML-string
// pattern as emails/InvoiceIssued.tsx.
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
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        Questions? Reply to this message or contact ${BILLING_EMAIL}.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${BILLING_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}

interface ArrangementApprovedProps {
  customerName: string
  invoiceNumber: string
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  frequency: string
  downPayment: number
  installmentCount: number
  scheduleSummary: string
}

export function arrangementApprovedSubject(invoiceNumber: string): string {
  return `Your Payment Arrangement Was Approved — Invoice #${invoiceNumber}`
}

export function buildArrangementApprovedHtml(props: ArrangementApprovedProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:20px;margin:0 0 12px">Your Payment Arrangement Was Approved</h2>
    <p style="font-size:15px;line-height:1.6;color:#424242">
      Hi ${props.customerName}, your payment-arrangement request for invoice <strong>#${props.invoiceNumber}</strong> has been approved.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:20px 0;text-align:left;font-size:14px;line-height:1.8">
      <p style="margin:0"><strong>Invoice Total:</strong> ${formatMoney(props.invoiceTotal)}</p>
      <p style="margin:0"><strong>Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
      <p style="margin:0"><strong>Current Balance Due:</strong> ${formatMoney(props.balanceDue)}</p>
      <p style="margin:10px 0 0"><strong>Approved Frequency:</strong> ${props.frequency}</p>
      <p style="margin:0"><strong>Approved Immediate Payment:</strong> ${formatMoney(props.downPayment)}</p>
      <p style="margin:0"><strong>Approved Installments:</strong> ${props.installmentCount}</p>
      <p style="margin:0"><strong>Approved Schedule:</strong> ${props.scheduleSummary}</p>
      <p style="margin:10px 0 0"><strong>Invoice Status:</strong> Pending</p>
      <p style="margin:0"><strong>Payment Status:</strong> ${props.paymentStatus}</p>
    </div>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      Payments will be recorded after they are manually verified.
    </p>
  `)
}

interface ArrangementDeniedProps {
  customerName: string
  invoiceNumber: string
  reason: string | null
  secureLink: string
  paymentStatus: string
  balanceDue: number
}

export function arrangementDeniedSubject(invoiceNumber: string): string {
  return `Update on Your Payment Arrangement Request — Invoice #${invoiceNumber}`
}

export function buildArrangementDeniedHtml(props: ArrangementDeniedProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:20px;margin:0 0 12px">Update on Your Payment Arrangement Request</h2>
    <p style="font-size:15px;line-height:1.6;color:#424242">
      Hi ${props.customerName}, your payment-arrangement request for invoice <strong>#${props.invoiceNumber}</strong> was not approved as submitted.
    </p>
    ${props.reason ? `<div style="background:#F5F5F0;border-radius:10px;padding:16px 20px;margin:16px 0;font-size:14px;line-height:1.6"><strong>Note from Pepscore:</strong><br/>${props.reason}</div>` : ''}
    <p style="font-size:14px;line-height:1.6;color:#424242">
      Please use your secure client link to choose Pay in Full, or submit a revised payment-arrangement request.
    </p>
    <p style="text-align:center;margin:20px 0">
      <a href="${props.secureLink}" style="display:inline-block;background:#1A1A1A;color:#fff;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:13px 28px;border-radius:8px">
        Review Invoice
      </a>
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      Invoice Status: Pending · Payment Status: ${props.paymentStatus} · Current Balance Due: ${formatMoney(props.balanceDue)}
    </p>
  `)
}
