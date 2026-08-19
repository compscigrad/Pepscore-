// Customer-facing nudge for a claimed-but-not-yet-purchased first-order
// offer (2026-08-12 AOAI conversion sprint). Sent by
// app/api/cron/first-order-offer-reminders/route.ts at day 2 and day 5
// after the claim (see lib/promotions/firstOrderReminderEligibility.ts),
// never more than twice, never after a real purchase. Same shell/CTA
// conventions as emails/FirstOrderOfferCode.tsx (the original code-
// delivery email this follows up on).
import { formatDiscountLabel } from '@/lib/promotions/format'
import type { PromotionType } from '@prisma/client'
import { buildEmailShell, emailCta, emailCtaOutline, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface FirstOrderOfferReminderProps {
  firstName: string
  publicTitle: string
  discountType: PromotionType
  discountValue: number
  code: string | null
  isFinalReminder: boolean
  customerId: string
}

export function firstOrderOfferReminderSubject(props: FirstOrderOfferReminderProps): string {
  return props.isFinalReminder
    ? `Last call — your ${formatDiscountLabel(props.discountType, props.discountValue)} offer is waiting`
    : `Your ${formatDiscountLabel(props.discountType, props.discountValue)} offer is still waiting`
}

export function buildFirstOrderOfferReminderHtml(props: FirstOrderOfferReminderProps): string {
  const signUpUrl = `${APP_URL}/sign-up?redirect_url=/account`
  const shopUrl = `${APP_URL}/categories`

  const codePanel = props.code
    ? emailPanel(`
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};text-align:center">Your Code</p>
        <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:2px;color:${EMAIL_COLORS.gold};text-align:center">${escapeHtml(props.code)}</p>
      `)
    : ''

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Hi ${escapeHtml(props.firstName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary};margin:0 0 20px">
      ${escapeHtml(props.publicTitle)} is still available on your first qualifying order${props.isFinalReminder ? ' — this is the last reminder we will send about it' : ''}.
    </p>
    ${codePanel}
    ${emailCta(shopUrl, 'Continue Shopping')}
    ${emailCtaOutline(signUpUrl, 'Create Your Account')}
    <p style="font-size:12px;color:${EMAIL_COLORS.textMuted};margin:0;text-align:center">Create or sign in to your Pepscore Lab account, then apply this code at checkout.</p>
  `

  return buildEmailShell({
    bodyHtml,
    footerNote: 'Questions about your offer? Reply to this email — we\'re happy to help.',
    unsubscribeUrl: `${APP_URL}/unsubscribe?c=${encodeURIComponent(props.customerId)}`,
  })
}
