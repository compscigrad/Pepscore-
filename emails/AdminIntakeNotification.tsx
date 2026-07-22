// Admin alert email — sent when a customer completes an intake link
// submission. Same branding pattern as InvoiceIssued.tsx/
// InvoiceShipmentUpdate.tsx. Recipients are whoever is configured under
// Settings -> Admin Notifications with emailEnabled, never a hardcoded
// address.
interface AdminIntakeNotificationProps {
  customerName: string
  invoiceNumber: string
  isNewCustomer: boolean
  possibleDuplicateOf?: string | null
  submittedAt: Date
}

export function adminIntakeNotificationSubject(customerName: string): string {
  return `New intake submitted — ${customerName}`
}

export function buildAdminIntakeNotificationHtml({
  customerName,
  invoiceNumber,
  isNewCustomer,
  possibleDuplicateOf,
  submittedAt,
}: AdminIntakeNotificationProps): string {
  const year = new Date().getFullYear()
  const badge = isNewCustomer
    ? `<span style="background:#1A1A1A;color:#C49A1A;padding:4px 10px;border-radius:999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-family:Helvetica,sans-serif">New Customer</span>`
    : `<span style="background:#F5F5F0;color:#424242;padding:4px 10px;border-radius:999px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;font-family:Helvetica,sans-serif;border:1px solid #E0DDD4">Existing Customer</span>`
  const duplicateWarning = possibleDuplicateOf
    ? `<p style="margin:12px 0 0;font-size:13px;color:#B45309">⚠ Possible duplicate customer — review before merging.</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Admin Notification</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">📋</div>
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">New Intake Submitted</h2>
      <p style="margin:0 0 16px">${badge}</p>
      <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:left">
        <p style="margin:0 0 4px;font-size:15px"><strong>Customer:</strong> ${customerName}</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Draft Invoice:</strong> ${invoiceNumber}</p>
        <p style="margin:0;font-size:15px"><strong>Submitted:</strong> ${submittedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        ${duplicateWarning}
      </div>
      <p style="color:#757575;font-size:13px;line-height:1.6">
        Open the draft invoice in the admin portal to review and finish fulfillment.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · contact@pepscore.com</p>
    </div>
  </div>
</body>
</html>`
}
