// Admin-facing alert fired when a backorder compensation creates a pending
// refund obligation that requires manual processing (no online-payment
// provider is integrated, so nothing completes itself). Same plain-HTML-
// string pattern as emails/AdminPaymentAlerts.tsx.
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

interface RefundActionRequiredProps {
  invoiceNumber: string
  invoiceId: string
  refundId: string
  clientName: string
  refundAmount: number
  reason: string
  appUrl: string
}

export function backorderFinancialActionRequiredSubject(invoiceNumber: string): string {
  return `Manual Refund Required — Invoice #${invoiceNumber}`
}

export function buildBackorderFinancialActionRequiredHtml(props: RefundActionRequiredProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">Manual Refund Required</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      A backorder compensation on Invoice <strong>#${props.invoiceNumber}</strong> (${props.clientName}) requires a
      real refund of <strong>${formatMoney(props.refundAmount)}</strong> — this invoice was already paid, so the
      compensation could not be applied as a discount.
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      No money has been returned yet. Pepscore has no automated refund provider, so this refund is recorded as
      <strong>Pending</strong> until you process it manually (e.g. through your payment terminal or bank) and mark it
      complete from the invoice page. The customer has not been told a refund is complete.
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6"><strong>Reason:</strong> ${props.reason}</p>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${adminLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        Open Invoice &amp; Process Refund
      </a>
    </p>
  `)
}

// Same alert, generic wording — for a refund requested directly (not via a
// backorder compensation). Kept as a separate pair rather than reusing
// backorderFinancialActionRequiredSubject/Html so the backorder path's exact
// wording and behavior stay untouched.
export function refundActionRequiredSubject(invoiceNumber: string): string {
  return `Manual Refund Required — Invoice #${invoiceNumber}`
}

export function buildRefundActionRequiredHtml(props: RefundActionRequiredProps): string {
  const adminLink = `${props.appUrl}/admin/invoices/${props.invoiceId}`
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">Manual Refund Required</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      A refund of <strong>${formatMoney(props.refundAmount)}</strong> was requested on Invoice
      <strong>#${props.invoiceNumber}</strong> (${props.clientName}).
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      No money has been returned yet. Pepscore has no automated refund provider, so this refund is recorded as
      <strong>Pending</strong> until you process it manually (e.g. through your payment terminal or bank) and mark it
      complete from the invoice page. The customer has not been told a refund is complete.
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6"><strong>Reason:</strong> ${props.reason}</p>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${adminLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        Open Invoice &amp; Process Refund
      </a>
    </p>
  `)
}

// A portal customer requested an email-address change — never applied
// automatically (see lib/portal/profile.ts's requestEmailChange), an admin
// must review and apply it via the customer's admin profile page.
interface ProfileEmailChangeRequestedProps {
  customerName: string
  customerId: string
  currentEmail: string | null
  requestedEmail: string
  appUrl: string
}

export function profileEmailChangeRequestedSubject(): string {
  return `Customer Requested an Email Change`
}

export function buildProfileEmailChangeRequestedHtml(props: ProfileEmailChangeRequestedProps): string {
  const adminLink = `${props.appUrl}/admin/customers/${props.customerId}`
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">Email Change Requested</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      <strong>${props.customerName}</strong> requested to change their portal account email from
      <strong>${props.currentEmail ?? '(none on file)'}</strong> to <strong>${props.requestedEmail}</strong>.
    </p>
    <p style="font-size:13px;color:#757575;line-height:1.6">
      This has not been changed automatically. Verify the request is genuine before updating it on the customer's
      profile — changing this email changes what a future portal login must match to claim or re-claim this account.
    </p>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${adminLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        Review Customer
      </a>
    </p>
  `)
}
