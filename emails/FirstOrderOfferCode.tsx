// Customer-facing discount-code delivery for a qualifying first-order
// acquisition offer (Promotion Campaign system) -- sent once, immediately
// after a successful claim.
// Refactored onto the shared PepScore Lab email shell (docs/Decisions.md)
// -- this template already used matching tokens (it was built in the same
// session as the shell), so this is a pure de-duplication: removes its own
// locally-defined header/footer/CTA/escapeHtml in favor of the shared
// versions, content unchanged. The two CTAs (primary "Create Your
// Account" + secondary "Shop PepScore Lab") now stack vertically instead
// of sitting side-by-side in one row -- the shared shell's dual-CTA
// convention, matching every other multi-CTA template going forward
// rather than this template's own one-off inline layout.
import { formatDiscountLabel } from '@/lib/promotions/format'
import type { PromotionType } from '@prisma/client'
import { buildEmailShell, emailCta, emailCtaOutline, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface FirstOrderOfferCodeProps {
  firstName: string
  publicTitle: string
  publicDescription?: string | null
  discountType: PromotionType
  discountValue: number
  code: string
  expiresAt: Date | null
}

export function firstOrderOfferCodeSubject(props: FirstOrderOfferCodeProps): string {
  return `Your ${formatDiscountLabel(props.discountType, props.discountValue)} code is here`
}

export function buildFirstOrderOfferCodeHtml(props: FirstOrderOfferCodeProps): string {
  const signUpUrl = `${APP_URL}/sign-up?redirect_url=/account`
  const shopUrl = `${APP_URL}/categories`
  const expiryLine = props.expiresAt
    ? `<p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Expires:</strong> ${props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
    : ''

  const codePanel = emailPanel(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};text-align:center">Your Code</p>
    <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:2px;color:${EMAIL_COLORS.gold};text-align:center">${escapeHtml(props.code)}</p>
  `)

  const detailsPanel = `
    <div style="font-size:13px;line-height:1.9;color:${EMAIL_COLORS.textSecondary};margin:0 0 8px">
      <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Discount:</strong> ${formatDiscountLabel(props.discountType, props.discountValue)}</p>
      ${expiryLine}
      <p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Redemption:</strong> One qualifying first order per customer</p>
    </div>
  `

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Hi ${escapeHtml(props.firstName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary};margin:0 0 20px">
      ${escapeHtml(props.publicTitle)}${props.publicDescription ? ` — ${escapeHtml(props.publicDescription)}` : ''} Here's your unique code, good for one qualifying first order.
    </p>
    ${codePanel}
    ${detailsPanel}
    ${emailCta(signUpUrl, 'Create Your Account')}
    ${emailCtaOutline(shopUrl, 'Shop PepScore Lab')}
    <p style="font-size:12px;color:${EMAIL_COLORS.textMuted};margin:0;text-align:center">Create or sign in to your Pepscore Lab account, then apply this code at checkout on your first qualifying order.</p>
  `

  return buildEmailShell({ bodyHtml, footerNote: 'Questions about your offer? Reply to this email — we\'re happy to help.' })
}
