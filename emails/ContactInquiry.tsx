// Public storefront contact/wholesale-inquiry form — two emails: the
// internal notification to contact@pepscorelab.com (so the team can read
// and manually respond using the visitor's own email, included in the
// body) and a short acknowledgement sent back to the visitor.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { CONTACT_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

// Subject lines are a single structured API field (not a raw header string
// we assemble), but stripping newlines defensively costs nothing and keeps
// a visitor's name from ever producing a multi-line subject.
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

export interface ContactInquiryProps {
  name: string
  email: string
  phone?: string
  company?: string
  inquiryType?: string
  message: string
}

export function contactInquiryAdminSubject(name: string): string {
  return `New Contact Inquiry — ${oneLine(name)}`
}

export function buildContactInquiryAdminHtml(props: ContactInquiryProps): string {
  const detailsPanel = emailPanel(`
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Name:</strong> ${escapeHtml(props.name)}</p>
    <p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Email:</strong> ${escapeHtml(props.email)}</p>
    ${props.phone ? `<p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Phone:</strong> ${escapeHtml(props.phone)}</p>` : ''}
    ${props.company ? `<p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Company:</strong> ${escapeHtml(props.company)}</p>` : ''}
    ${props.inquiryType ? `<p style="margin:0;font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Inquiry Type:</strong> ${escapeHtml(props.inquiryType)}</p>` : ''}
  `)

  const bodyHtml = `
    <h2 style="font-size:18px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">New inquiry from the website</h2>
    ${detailsPanel}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary};white-space:pre-wrap">${escapeHtml(props.message)}</p>
  `
  return buildEmailShell({
    eyebrow: 'New Inquiry',
    bodyHtml,
    footerNote: `Reply directly to this visitor at the email address above — this notification itself is sent from Pepscore Lab's system identity, not the visitor's inbox.`,
  })
}

export function contactInquiryAcknowledgementSubject(): string {
  return `We've received your message — Pepscore Lab`
}

export function buildContactInquiryAcknowledgementHtml(props: { name: string }): string {
  const bodyHtml = `
    <h2 style="font-size:18px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.name)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Thanks for reaching out to Pepscore Lab. We've received your message and a member of our team will get back to
      you shortly.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      If your inquiry is time-sensitive, you can also reach us directly at ${CONTACT_EMAIL}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Message Received', bodyHtml, footerNote: `Reach out anytime at ${CONTACT_EMAIL} with questions.` })
}
