// Customer-facing emails for the Professional Access application/invite
// lifecycle (2026-08-19 Professional Access sprint). Reuses the shared
// Pepscore Lab email shell exactly like every other template in this
// codebase (docs/Decisions.md) -- no one-off styling. Deliberately never
// makes a treatment/human-use claim anywhere in this file (section 10's
// standing rule): Professional Access changes pricing/purchasing terms
// only, never the research-use status of the products themselves.
import { ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

const RUO_FOOTER = 'Professional Access changes case pricing and purchasing terms only -- it does not change the Research Use Only status or labeling of any product.'

export interface ApplicationReceivedProps {
  contactName: string
  businessName: string
}

export function professionalAccessApplicationReceivedSubject(): string {
  return 'Your Professional Access Application Was Received'
}

export function buildProfessionalAccessApplicationReceivedHtml(props: ApplicationReceivedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Thanks for applying for Professional Access on behalf of ${escapeHtml(props.businessName)}. Our team reviews every
      application by hand -- we'll follow up by email once yours has been reviewed, or sooner if we need any
      additional information.
    </p>
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">${RUO_FOOTER}</p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Questions in the meantime? Reach out anytime at ${ADMIN_EMAIL}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface MoreInfoRequestedProps {
  contactName: string
  businessName: string
  reviewNotes: string
}

export function professionalAccessMoreInfoRequestedSubject(): string {
  return 'A Quick Follow-Up on Your Professional Access Application'
}

export function buildProfessionalAccessMoreInfoRequestedHtml(props: MoreInfoRequestedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      We're reviewing your Professional Access application for ${escapeHtml(props.businessName)} and need a bit more
      information before we can finish:
    </p>
    ${emailPanel(`<p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textPrimary};margin:0;white-space:pre-line;">${escapeHtml(props.reviewNotes)}</p>`)}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Just reply to this email with the details and we'll pick your review back up right away.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface ApprovedProps {
  contactName: string
  businessName: string
  storefrontUrl: string
}

export function professionalAccessApprovedSubject(): string {
  return "You're Approved for Professional Access"
}

export function buildProfessionalAccessApprovedHtml(props: ApprovedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Good news -- ${escapeHtml(props.businessName)} is approved for Professional Access. Sign in with the email
      address on this application and Professional Case pricing will show automatically on every eligible product.
    </p>
    ${emailCta(props.storefrontUrl, 'Browse the Catalog')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      Professional orders are produced to order and ship in approximately two weeks. ${RUO_FOOTER}
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface RejectedProps {
  contactName: string
  businessName: string
  reviewNotes?: string | null
}

export function professionalAccessRejectedSubject(): string {
  return 'An Update on Your Professional Access Application'
}

export function buildProfessionalAccessRejectedHtml(props: RejectedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      After review, we're not able to approve Professional Access for ${escapeHtml(props.businessName)} at this time.
      ${props.reviewNotes ? escapeHtml(props.reviewNotes) : ''}
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Standard pricing, including automatic case-volume savings, is still available on every order. Reach out at
      ${ADMIN_EMAIL} if anything changes or you'd like to discuss further.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface InviteProps {
  recipientName?: string | null
  claimUrl: string
  expiresAt: Date
}

export function professionalAccessInviteSubject(): string {
  return "You're Invited: Pepscore Lab Professional Access"
}

export function buildProfessionalAccessInviteHtml(props: InviteProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi${props.recipientName ? ' ' + escapeHtml(props.recipientName) : ''},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      You've been personally invited to Pepscore Lab Professional Access -- preferred case pricing for verified
      businesses and research organizations.
    </p>
    ${emailCta(props.claimUrl, 'Accept Invitation')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      You'll be asked to sign in or create an account using this email address to confirm it's really you. This
      invitation expires ${expiresLabel} and can only be used once. ${RUO_FOOTER}
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export function professionalAccessInviteReminderSubject(): string {
  return 'Your Pepscore Lab Professional Access Invitation Is Still Open'
}

export function buildProfessionalAccessInviteReminderHtml(props: InviteProps): string {
  const expiresLabel = props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi${props.recipientName ? ' ' + escapeHtml(props.recipientName) : ''},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Just a reminder -- your Pepscore Lab Professional Access invitation is still open.
    </p>
    ${emailCta(props.claimUrl, 'Accept Invitation')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">This invitation expires ${expiresLabel} and can only be used once.</p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface RevokedProps {
  contactName: string
}

export function professionalAccessRevokedSubject(): string {
  return 'Your Professional Access Status Has Changed'
}

export function buildProfessionalAccessRevokedHtml(props: RevokedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your account's Professional Access has been deactivated. You can continue to order at standard pricing,
      including automatic case-volume savings, at any time.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Questions about this change? Reach out at ${ADMIN_EMAIL}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Professional Access', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}
