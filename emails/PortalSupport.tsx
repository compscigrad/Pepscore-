// Customer-facing acknowledgement for a portal support-form submission.
// The admin-facing alert lives in emails/AdminBackorderAlerts.tsx's sibling
// pattern — see buildSupportRequestAdminAlertHtml below, same file for
// locality since both fire from the same submission.
import { SUPPORT_EMAIL } from '@/lib/resend'

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
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${SUPPORT_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}

function adminShell(bodyHtml: string): string {
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

export interface SupportRequestReceivedProps {
  customerName: string
  message: string
}

export function supportRequestReceivedSubject(): string {
  return `We've Received Your Message`
}

export function buildSupportRequestReceivedHtml(props: SupportRequestReceivedProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${props.customerName},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      We've received your message and someone from our team will get back to you shortly.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:13px;line-height:1.7;color:#424242">
      ${props.message.replace(/\n/g, '<br/>')}
    </div>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Reach out anytime at ${SUPPORT_EMAIL} with anything else.
    </p>
  `)
}

export interface SupportRequestAdminAlertProps {
  customerName: string
  customerId: string
  message: string
  invoiceNumber: string | null
  invoiceId: string | null
  appUrl: string
}

export function supportRequestAdminAlertSubject(customerName: string): string {
  return `New Support Request — ${customerName}`
}

export function buildSupportRequestAdminAlertHtml(props: SupportRequestAdminAlertProps): string {
  const customerLink = `${props.appUrl}/admin/customers/${props.customerId}`
  const invoiceLink = props.invoiceId ? `${props.appUrl}/admin/invoices/${props.invoiceId}` : null
  return adminShell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:18px;margin:0 0 12px">New Support Request</h2>
    <p style="font-size:14px;line-height:1.6;color:#424242">
      <strong>${props.customerName}</strong> submitted a support request${props.invoiceNumber ? ` about Invoice #${props.invoiceNumber}` : ''}.
    </p>
    <div style="background:#F5F5F0;border-radius:10px;padding:16px 18px;margin:14px 0;font-size:13px;line-height:1.7;color:#424242">
      ${props.message.replace(/\n/g, '<br/>')}
    </div>
    <p style="text-align:center;margin:22px 0 0">
      <a href="${invoiceLink ?? customerLink}" style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 26px;border-radius:8px">
        ${invoiceLink ? 'Open Invoice' : 'Open Customer'}
      </a>
    </p>
  `)
}
