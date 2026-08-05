// Public storefront contact/wholesale-inquiry form — two emails: the
// internal notification to contact@pepscorelab.com (so the team can read
// and manually respond using the visitor's own email, included in the
// body) and a short acknowledgement sent back to the visitor. Same
// plain-HTML-string shell pattern as emails/BackorderNotice.tsx.
import { CONTACT_EMAIL } from '@/lib/resend'

// All visitor-supplied text is untrusted — escaped before being interpolated
// into the HTML body, same posture the rest of this codebase takes at every
// other public-input boundary (e.g. lib/tracking/sanitize.ts).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Subject lines are a single structured API field (not a raw header string
// we assemble), but stripping newlines defensively costs nothing and keeps
// a visitor's name from ever producing a multi-line subject.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
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
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · ${CONTACT_EMAIL}</p>
    </div>
  </div>
</body>
</html>`
}

export interface ContactInquiryProps {
  name: string
  email: string
  phone?: string
  company?: string
  message: string
}

export function contactInquiryAdminSubject(name: string): string {
  return `New Contact Inquiry — ${oneLine(name)}`
}

export function buildContactInquiryAdminHtml(props: ContactInquiryProps): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">New inquiry from the website</h2>
    <div style="background:#F5F5F0;border-radius:10px;padding:18px 20px;margin:0 0 18px;font-size:13px;line-height:1.9;color:#424242">
      <p style="margin:0"><strong>Name:</strong> ${escapeHtml(props.name)}</p>
      <p style="margin:0"><strong>Email:</strong> ${escapeHtml(props.email)}</p>
      ${props.phone ? `<p style="margin:0"><strong>Phone:</strong> ${escapeHtml(props.phone)}</p>` : ''}
      ${props.company ? `<p style="margin:0"><strong>Company:</strong> ${escapeHtml(props.company)}</p>` : ''}
    </div>
    <p style="font-size:14px;line-height:1.7;color:#424242;white-space:pre-wrap">${escapeHtml(props.message)}</p>
    <p style="font-size:12px;color:#9E9E9E;margin-top:18px">Reply directly to this visitor at the email address above — this notification itself is sent from Pepscore's system identity, not the visitor's inbox.</p>
  `)
}

export function contactInquiryAcknowledgementSubject(): string {
  return `We've received your message — Pepscore`
}

export function buildContactInquiryAcknowledgementHtml(props: { name: string }): string {
  return shell(`
    <h2 style="font-family:Helvetica,sans-serif;font-size:19px;margin:0 0 14px">Hi ${escapeHtml(props.name)},</h2>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      Thanks for reaching out to Pepscore. We've received your message and a member of our team will get back to
      you shortly.
    </p>
    <p style="font-size:14px;line-height:1.7;color:#424242">
      If your inquiry is time-sensitive, you can also reach us directly at ${CONTACT_EMAIL}.
    </p>
  `)
}
