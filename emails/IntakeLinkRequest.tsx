// Customer-facing email — delivers the intake link itself (distinct from
// AdminIntakeNotification.tsx, which alerts the admin *after* a submission).
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { CONTACT_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface IntakeLinkRequestProps {
  customerName: string
  link: string
}

export function intakeLinkRequestSubject(): string {
  return 'Complete your Pepscore Lab order details'
}

export function buildIntakeLinkRequestHtml({ customerName, link }: IntakeLinkRequestProps): string {
  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px;text-align:center">Hi ${escapeHtml(customerName)},</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6;margin:0 0 8px;text-align:center">
      Please use the secure link below to confirm your contact, billing, and shipping details so we can finish
      setting up your order.
    </p>
    ${emailCta(link, 'Complete Your Information')}
    <p style="color:${EMAIL_COLORS.textMuted};font-size:12px;line-height:1.6;margin:0;text-align:center">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${link}" style="color:${EMAIL_COLORS.gold};word-break:break-all">${link}</a>
    </p>
  `

  return buildEmailShell({ eyebrow: 'Customer Information', bodyHtml, footerNote: `Questions? Reply to this email or contact ${CONTACT_EMAIL}.` })
}
