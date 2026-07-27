// Admin-facing alerts fired the moment a client submits a Pay in Full
// selection (Section 12) or a payment-arrangement request (Section 16).
// Same plain-HTML-string pattern as emails/InvoiceIssued.tsx — no template
// library, sent directly through Resend. Both explicitly state that nothing
// has been confirmed as received yet, matching the spec's suggested wording
// verbatim in substance.
function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shell(bodyHtml: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:24px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:22px;margin:0;letter-spacing:0.1em">PEPSCORE ADMIN</h1>
    </div>
    <div style="padding:32px 36px">${bodyHtml}</div>
    <div style="background:#1A1A1A;padding:16px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore</p>
    </div>
  </div>
</body>
</html>`
}

interface PaymentSelectionPendingProps {
  invoiceNumber: string
  invoiceId: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  selectedMethod: string
  submittedAt: Date
  appUrl: string
}

export function paymentSelectionPendingSubject(invoiceNumber: string): string {
  return `Payment Selection Pending — Invoice #${invoiceNumber}`
}

export function buildPaymentSelectionPendingHtml(props: PaymentSelectionPendingProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">Payment Selection Pending</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      The client has submitted a Pay in Full payment selection for Invoice <strong>#${props.invoiceNumber}</strong>.
      The invoice has automatically changed to <strong>Pending</strong>.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:18px 20px;margin:18px 0;font-size:13px;line-height:1.8">
      <p style="margin:0"><strong>Client:</strong> ${props.clientName}</p>
      <p style="margin:0"><strong>Phone:</strong> ${props.clientPhone ?? '—'}</p>
      <p style="margin:0"><strong>Email:</strong> ${props.clientEmail ?? '—'}</p>
      <p style="margin:0"><strong>Selected Method:</strong> ${props.selectedMethod}</p>
      <p style="margin:0"><strong>Invoice Total:</strong> ${formatMoney(props.invoiceTotal)}</p>
      <p style="margin:0"><strong>Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
      <p style="margin:0"><strong>Remaining Balance:</strong> ${formatMoney(props.balanceDue)}</p>
      <p style="margin:0"><strong>Submitted:</strong> ${props.submittedAt.toLocaleString('en-US')}</p>
    </div>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      This invoice is awaiting manual payment verification. No additional payment has been recorded or confirmed by
      this submission.
    </p>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${adminLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        Open Invoice
      </a>
    </p>
  `)
}

interface ArrangementRequestPendingProps {
  invoiceNumber: string
  invoiceId: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  invoiceTotal: number
  amountPaid: number
  balanceDue: number
  paymentStatus: string
  frequency: string
  proposedDownPayment: number
  installmentCount: number
  scheduleSummary: string
  submittedAt: Date
  appUrl: string
}

export function arrangementRequestPendingSubject(invoiceNumber: string): string {
  return `Payment Arrangement Approval Required — Invoice #${invoiceNumber}`
}

export function buildArrangementRequestPendingHtml(props: ArrangementRequestPendingProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">Payment Arrangement Approval Required</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      The client has requested a payment arrangement for Invoice <strong>#${props.invoiceNumber}</strong>.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:18px 20px;margin:18px 0;font-size:13px;line-height:1.8">
      <p style="margin:0"><strong>Client:</strong> ${props.clientName}</p>
      <p style="margin:0"><strong>Phone:</strong> ${props.clientPhone ?? '—'}</p>
      <p style="margin:0"><strong>Email:</strong> ${props.clientEmail ?? '—'}</p>
      <p style="margin:0"><strong>Invoice Status:</strong> Pending</p>
      <p style="margin:0"><strong>Payment Status:</strong> ${props.paymentStatus}</p>
      <p style="margin:0"><strong>Confirmed Amount Paid:</strong> ${formatMoney(props.amountPaid)}</p>
      <p style="margin:0"><strong>Current Balance Due:</strong> ${formatMoney(props.balanceDue)}</p>
      <p style="margin:8px 0 0"><strong>Requested Frequency:</strong> ${props.frequency}</p>
      <p style="margin:0"><strong>Proposed Immediate Payment:</strong> ${formatMoney(props.proposedDownPayment)}</p>
      <p style="margin:0"><strong>Proposed Installments:</strong> ${props.installmentCount}</p>
      <p style="margin:0"><strong>Proposed Schedule:</strong> ${props.scheduleSummary}</p>
      <p style="margin:0"><strong>Submitted:</strong> ${props.submittedAt.toLocaleString('en-US')}</p>
    </div>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      This request has not been approved, and no proposed payment has been recorded as received.
    </p>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${adminLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        Review &amp; Approve or Deny
      </a>
    </p>
  `)
}
