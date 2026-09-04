// Customer-facing emails for the Price Match Guarantee / Customer Preferred
// Pricing lifecycle (2026-08-20 Price Match sprint). Reuses the shared
// Pepscore Lab email shell exactly like every other template in this
// codebase -- no one-off styling. Never states or implies an unconditional
// guarantee (public-copy rule): every approval/rejection email is written
// as "after review," matching the storefront's own careful wording.
import { ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { formatDateTimeForViewer } from '@/lib/dateFormat'

export interface RequestReceivedProps {
  contactName: string
  productName: string
  productSize: string
}

export function priceMatchRequestReceivedSubject(): string {
  return 'Your Price Match Request Was Received'
}

export function buildPriceMatchRequestReceivedHtml(props: RequestReceivedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your price match request for ${escapeHtml(props.productName)} (${escapeHtml(props.productSize)}) has been received.
      A member of the Pepscore Lab team reviews every request by hand and will get back to you as soon as possible.
    </p>
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">
      Price matches are reviewed against the total delivered price (item + shipping) from a verifiable source, and are
      granted at our discretion.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface MoreInfoRequestedProps {
  contactName: string
  productName: string
  reviewNotes: string
}

export function priceMatchMoreInfoRequestedSubject(): string {
  return 'A Quick Follow-Up on Your Price Match Request'
}

export function buildPriceMatchMoreInfoRequestedHtml(props: MoreInfoRequestedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      We're reviewing your price match request for ${escapeHtml(props.productName)} and need a bit more information
      before we can finish:
    </p>
    ${emailPanel(`<p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textPrimary};margin:0;white-space:pre-line;">${escapeHtml(props.reviewNotes)}</p>`)}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Just reply to this email with the details and we'll pick your review back up right away.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface ApprovedOneTimeProps {
  contactName: string
  productName: string
  productSize: string
  authorizedPrice: number
  storefrontUrl: string
}

export function priceMatchApprovedOneTimeSubject(): string {
  return "You're Approved for a Price Match"
}

export function buildPriceMatchApprovedOneTimeHtml(props: ApprovedOneTimeProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Good news -- your price match request for ${escapeHtml(props.productName)} (${escapeHtml(props.productSize)}) was
      approved at <strong style="color:${EMAIL_COLORS.textPrimary}">$${props.authorizedPrice.toFixed(2)}</strong>. Sign in
      with the email address on this request and the matched price will apply automatically to your next purchase of this
      item.
    </p>
    ${emailCta(props.storefrontUrl, 'Shop Now')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">This match is valid for one purchase.</p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface ApprovedPersistentProps extends ApprovedOneTimeProps {
  expiresAt: Date | null
}

export function priceMatchApprovedPersistentSubject(): string {
  return "You're Approved for a Preferred Price"
}

export function buildPriceMatchApprovedPersistentHtml(props: ApprovedPersistentProps): string {
  const expiresLine = props.expiresAt
    ? `This preferred price is valid through ${props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
    : 'This preferred price stays in effect on your account until we ever need to revisit it.'
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Good news -- your price match request for ${escapeHtml(props.productName)} (${escapeHtml(props.productSize)}) was
      approved as an ongoing preferred price of
      <strong style="color:${EMAIL_COLORS.textPrimary}">$${props.authorizedPrice.toFixed(2)}</strong>. Sign in with the
      email address on this request and this price will apply automatically every time you order this item -- no code to
      remember.
    </p>
    ${emailCta(props.storefrontUrl, 'Shop Now')}
    <p style="font-size:13px;line-height:1.7;color:${EMAIL_COLORS.textMuted}">${expiresLine}</p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface RejectedProps {
  contactName: string
  productName: string
  reviewNotes?: string | null
}

export function priceMatchRejectedSubject(): string {
  return 'An Update on Your Price Match Request'
}

export function buildPriceMatchRejectedHtml(props: RejectedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      After review, we're not able to match the price you found for ${escapeHtml(props.productName)} at this time.
      ${props.reviewNotes ? escapeHtml(props.reviewNotes) : ''}
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out at ${ADMIN_EMAIL} if anything changes or you'd like to discuss further.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

export interface RevokedProps {
  contactName: string
  productName: string
}

export function priceMatchRevokedSubject(): string {
  return 'Your Preferred Price Has Changed'
}

export function buildPriceMatchRevokedHtml(props: RevokedProps): string {
  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.contactName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Your preferred price on ${escapeHtml(props.productName)} has been deactivated. You'll continue to see our standard
      pricing, including automatic case-volume savings, on your next order.
    </p>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Questions about this change? Reach out at ${ADMIN_EMAIL}.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Price Match Guarantee', bodyHtml, footerNote: `Questions? Reply to this email or contact ${ADMIN_EMAIL}.` })
}

// Admin-facing alert -- same "courtesy on top of the durably-recorded row"
// role as LeadCaptured/PROFESSIONAL_ACCESS_APPLICATION_ALERT. When a proof
// file was submitted, it's attached directly to this exact email (see
// lib/priceMatch/requests.ts) -- Google Workspace becomes the durable copy,
// Pepscore never stores the bytes. hasProofAttachment only ever controls
// this email's own "Proof attached" line, never whether the attachment
// itself is included -- that's decided entirely by the caller passing
// SendEmailInput.attachments or not.
export interface PriceMatchRequestAlertProps {
  requestNumber: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  preferredContactMethod: 'EMAIL' | 'PHONE'
  productName: string
  productSize: string
  competitorName: string
  competitorDeliveredPrice: number
  currentPrice: number | null
  isNewCustomer: boolean
  submittedAt: Date
  hasProofAttachment: boolean
  reviewUrl: string
}

export function priceMatchRequestAlertSubject(props: PriceMatchRequestAlertProps): string {
  return `New Price Match Request ${props.requestNumber} — ${props.contactName} (${props.productName})`
}

export function buildPriceMatchRequestAlertHtml(props: PriceMatchRequestAlertProps): string {
  const submittedLabel = formatDateTimeForViewer(props.submittedAt)
  const detailsPanel = emailPanel(`
    <p style="margin:0"><strong style="color:${EMAIL_COLORS.textPrimary}">Request ID:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.requestNumber)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Product:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.productName)} (${escapeHtml(props.productSize)})</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Competitor:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.competitorName)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Delivered price found:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">$${props.competitorDeliveredPrice.toFixed(2)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Our current price:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.currentPrice != null ? `$${props.currentPrice.toFixed(2)}` : 'n/a'}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Contact:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.contactName)} (${escapeHtml(props.contactEmail)})</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Preferred Contact:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.preferredContactMethod} — ${escapeHtml(props.preferredContactMethod === 'PHONE' ? (props.contactPhone ?? 'no phone on file') : props.contactEmail)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Submitted:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(submittedLabel)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Proof:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${props.hasProofAttachment ? 'Attached to this email' : 'None submitted'}</span></p>
  `)

  const bodyHtml = `
    <h2 style="font-size:18px;margin:0 0 14px;color:${EMAIL_COLORS.textPrimary};text-align:center">New price match request${props.isNewCustomer ? ' (new customer)' : ' (existing customer)'}</h2>
    ${detailsPanel}
    ${emailCta(props.reviewUrl, 'Review Request')}
  `

  return buildEmailShell({ eyebrow: `Admin Notification — ${props.requestNumber}`, bodyHtml, footerNote: 'Review and respond from the admin Price Match queue.' })
}
