// Customer-facing emails for portal account claiming — the invite itself,
// the day-3/day-6 reminder, and the confirmation once claimed. The invite
// email deliberately never mentions or embeds the raw token in a way that
// implies clicking alone grants access — the link still requires signing
// in with a matching verified email before anything is linked (see
// lib/portalInvites.ts's claim flow).
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only. The SMS body below
// is deliberately left untouched -- SMS wording changes are a separate,
// later slice pending a Twilio A2P consent-wording audit.
import { ORDERS_EMAIL, ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

export interface PortalInviteProps {
  customerName: string
  claimUrl: string
  expiresAt: Date
}

export function portalInviteSubject(): string {
  return `Set Up Your Pepscore Lab Account`
}

export function buildPortalInviteHtml(props: PortalInviteProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      You can now view your invoices, order status, tracking, and payment history online, anytime.
    </p>
    ${emailCta(props.claimUrl, 'Set Up My Account')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      You'll be asked to sign in or create an account using this email address — that's how we confirm it's really
      you. This link expires ${expiresLabel} and can only be used once.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${ORDERS_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Account Setup', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ORDERS_EMAIL}.` })
}

export interface PortalInviteReminderProps {
  customerName: string
  claimUrl: string
  expiresAt: Date
}

export function portalInviteReminderSubject(): string {
  return `Your Pepscore Lab Customer Profile Is Ready`
}

export function buildPortalInviteReminderHtml(props: PortalInviteReminderProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your Pepscore Lab customer profile is ready. Set up your secure account to view your invoices, payments,
      previous purchases, order status, tracking, and account communications. Pepscore Lab's expanded online store
      and inventory features are still under construction and will become available through this same account
      as they launch.
    </p>
    ${emailCta(props.claimUrl, 'Set Up My Account')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      This link expires ${expiresLabel} and can only be used once.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${ADMIN_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Account Setup', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

// SMS bodies live alongside their email counterparts (same notification,
// two channels) rather than in a separate file. Deliberately terse and
// transactional per the compliance requirement — no invoice/balance/product
// detail, just enough to identify Pepscore and link to the secure setup
// flow. "Reply STOP" is required opt-out language for any Twilio send.
// Left exactly as-is -- SMS wording is a separate, later slice pending a
// Twilio A2P consent-wording audit, not part of this email-only migration.
export function portalInviteSmsBody(claimUrl: string): string {
  return `Pepscore: Your customer profile is ready. Set up your secure account to view invoices, payments, purchases, tracking, and updates: ${claimUrl}. Reply STOP to opt out of texts.`
}

export interface PortalAccountClaimedProps {
  customerName: string
  portalUrl: string
}

export function portalAccountClaimedSubject(): string {
  return `Your Pepscore Lab Account Is Ready`
}

export function buildPortalAccountClaimedHtml(props: PortalAccountClaimedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your account is set up. You can now sign in anytime to view your invoices, tracking, and payment history.
    </p>
    ${emailCta(props.portalUrl, 'Go to My Account')}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${ORDERS_EMAIL} with questions.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Account Setup', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ORDERS_EMAIL}.` })
}
