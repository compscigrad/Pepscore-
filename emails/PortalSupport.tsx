// Customer-facing acknowledgement for a portal support-form submission, plus
// the admin-facing alert that fires from the same submission.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { SUPPORT_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

export interface SupportRequestReceivedProps {
  customerName: string
  message: string
}

export function supportRequestReceivedSubject(): string {
  return `We've Received Your Message`
}

export function buildSupportRequestReceivedHtml(props: SupportRequestReceivedProps): string {
  const messagePanel = emailPanel(
    `<p style="margin:0;font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.message).replace(/\n/g, '<br/>')}</p>`
  )

  const bodyHtml = `
    <h2 style="font-size:18px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      We've received your message and someone from our team will get back to you shortly.
    </p>
    ${messagePanel}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${SUPPORT_EMAIL} with anything else.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Support Request Received', bodyHtml, footerNote: `Reach out anytime at ${SUPPORT_EMAIL} with questions.` })
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
  const messagePanel = emailPanel(
    `<p style="margin:0;font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.message).replace(/\n/g, '<br/>')}</p>`
  )

  const bodyHtml = `
    <h2 style="font-size:17px;color:${EMAIL_COLORS.textPrimary};margin:0 0 12px">New Support Request</h2>
    <p style="font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textSecondary}">
      <strong style="color:${EMAIL_COLORS.textPrimary}">${escapeHtml(props.customerName)}</strong> submitted a support request${props.invoiceNumber ? ` about Invoice #${escapeHtml(props.invoiceNumber)}` : ''}.
    </p>
    ${messagePanel}
    ${emailCta(invoiceLink ?? customerLink, invoiceLink ? 'Open Invoice' : 'Open Customer')}
  `
  return buildEmailShell({ eyebrow: 'Admin Alert', bodyHtml, footerNote: 'This is an internal admin notification.' })
}
