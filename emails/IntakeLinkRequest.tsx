// Customer-facing email — delivers the intake link itself (distinct from
// AdminIntakeNotification.tsx, which alerts the admin *after* a submission).
// Same branding pattern as InvoiceIssued.tsx.
import { CONTACT_EMAIL } from '@/lib/resend'

interface IntakeLinkRequestProps {
  customerName: string
  link: string
}

export function intakeLinkRequestSubject(): string {
  return 'Complete your Pepscore order details'
}

export function buildIntakeLinkRequestHtml({ customerName, link }: IntakeLinkRequestProps): string {
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Customer Information</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">Hi ${customerName},</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6;margin:0 0 24px">
        Please use the secure link below to confirm your contact, billing, and shipping details so we can finish
        setting up your order.
      </p>
      <a
        href="${link}"
        style="display:inline-block;background:#C49A1A;color:#1A1A1A;font-family:Helvetica,sans-serif;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px"
      >
        Complete Your Information
      </a>
      <p style="color:#9E9E9E;font-size:12px;line-height:1.6;margin:24px 0 0">
        If the button doesn't work, copy and paste this link into your browser:<br />
        <a href="${link}" style="color:#8A6D14;word-break:break-all">${link}</a>
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${CONTACT_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}
