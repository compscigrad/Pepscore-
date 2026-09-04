// Birthday promotion code delivery (2026-09-03 customer lifecycle sprint).
// Sent once per birthday cycle by app/api/cron/birthday-promotions/route.ts
// -- never to a Professional Access account (generateBirthdayCode already
// refuses to issue one; this template is never reached for that case).
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'
import { BIRTHDAY_DISCOUNT_PERCENT, BIRTHDAY_CODE_VALIDITY_DAYS } from '@/lib/pricing/birthdayPromotion'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export interface BirthdayPromotionProps {
  firstName: string
  code: string
  expiresAt: Date
}

export function birthdayPromotionSubject(): string {
  return `Happy Birthday! Here's ${BIRTHDAY_DISCOUNT_PERCENT}% off from Pepscore Lab`
}

export function buildBirthdayPromotionHtml(props: BirthdayPromotionProps): string {
  const shopUrl = `${APP_URL}/categories`
  const codePanel = emailPanel(`
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted};text-align:center">Your Birthday Code</p>
    <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:2px;color:${EMAIL_COLORS.gold};text-align:center">${escapeHtml(props.code)}</p>
  `)

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Happy Birthday, ${escapeHtml(props.firstName)}!</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary};margin:0 0 20px">
      As a thank-you, enjoy ${BIRTHDAY_DISCOUNT_PERCENT}% off your next order. This code is unique to you, good for one use, and valid for
      ${BIRTHDAY_CODE_VALIDITY_DAYS} days (expires ${props.expiresAt.toLocaleDateString('en-US', { timeZone: 'UTC' })}).
    </p>
    ${codePanel}
    ${emailCta(shopUrl, 'Shop Now')}
  `
  return buildEmailShell({ eyebrow: 'Birthday Gift', bodyHtml, footerNote: 'This offer is not available on Professional Access accounts.' })
}

export function buildBirthdayPromotionSms(props: BirthdayPromotionProps): string {
  return `Happy Birthday from Pepscore Lab! Enjoy ${BIRTHDAY_DISCOUNT_PERCENT}% off with code ${props.code}, valid ${BIRTHDAY_CODE_VALIDITY_DAYS} days. Reply STOP to opt out of texts.`
}
