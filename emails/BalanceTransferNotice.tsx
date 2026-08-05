// Sent when an admin moves a remaining balance from one invoice onto
// another (lib/balanceTransfers.ts) — explains clearly which invoice the
// balance moved from/to and what the customer owes now, per the sprint's
// "customer communications explain clearly" requirement. Same plain-HTML
// shell pattern as emails/BackorderNotice.tsx.
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

export interface BalanceTransferNoticeProps {
  customerName: string
  amount: number
  sourceInvoiceNumber: string
  destinationInvoiceNumber: string
  destinationBalanceDue: number
}

export function balanceTransferNoticeSubject(destinationInvoiceNumber: string): string {
  return `Your Balance Has Been Moved — Invoice #${destinationInvoiceNumber}`
}

export function buildBalanceTransferNoticeHtml(props: BalanceTransferNoticeProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      A remaining balance of <strong>${formatMoney(props.amount)}</strong> from invoice
      <strong>#${props.sourceInvoiceNumber}</strong> has been moved onto invoice
      <strong>#${props.destinationInvoiceNumber}</strong>. Invoice #${props.sourceInvoiceNumber} no longer has a
      balance owed on it — going forward, please use invoice #${props.destinationInvoiceNumber} for this amount.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:18px 20px;margin:18px 0;font-size:13px;line-height:1.8;color:#424242">
      <p style="margin:0"><strong>Current balance due on #${props.destinationInvoiceNumber}:</strong> ${formatMoney(props.destinationBalanceDue)}</p>
    </div>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${BILLING_EMAIL} with questions about either invoice.
    </p>
  `)
}
