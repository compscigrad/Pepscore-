// Customer-facing discount-code delivery for a qualifying first-order
// acquisition offer (Promotion Campaign system) -- sent once, immediately
// after a successful claim. Same plain-HTML-string shell pattern as
// emails/LeadCaptured.tsx, using the current "Pepscore Lab" dark branding.
import { formatDiscountLabel } from '@/lib/promotions/format'
import type { PromotionType } from '@prisma/client'

const CONTENT_BG = '#0d0d0d'
const CARD_BG = '#161616'
const GOLD = '#D4AF37'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    ? `<p style="margin:0 0 4px"><strong style="color:#fff">Expires:</strong> ${props.expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:Helvetica,Arial,sans-serif;background:#000;color:#fff;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:${CONTENT_BG};border-radius:12px;overflow:hidden">
    <div style="background:#000;padding:26px 36px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
      <span style="font-size:20px;font-weight:800;color:#fff">Pepscore</span>
      <span style="font-size:20px;font-weight:800;color:${GOLD}"> Lab</span>
    </div>
    <div style="padding:32px 36px">
      <h2 style="font-size:18px;margin:0 0 8px;color:#fff">Hi ${escapeHtml(props.firstName)},</h2>
      <p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,0.75);margin:0 0 20px">
        ${escapeHtml(props.publicTitle)}${props.publicDescription ? ` — ${escapeHtml(props.publicDescription)}` : ''} Here's your unique code, good for one qualifying first order.
      </p>
      <div style="background:${CARD_BG};border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:22px;margin:0 0 22px;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.5)">Your Code</p>
        <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:2px;color:${GOLD}">${escapeHtml(props.code)}</p>
      </div>
      <div style="font-size:13px;line-height:1.9;color:rgba(255,255,255,0.7);margin:0 0 24px">
        <p style="margin:0 0 4px"><strong style="color:#fff">Discount:</strong> ${formatDiscountLabel(props.discountType, props.discountValue)}</p>
        ${expiryLine}
        <p style="margin:0"><strong style="color:#fff">Redemption:</strong> One qualifying first order per customer</p>
      </div>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${signUpUrl}" style="display:inline-block;background:${GOLD};color:#000;font-weight:700;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:999px;margin:0 8px 10px">Create Your Account</a>
        <a href="${shopUrl}" style="display:inline-block;background:transparent;border:1px solid rgba(212,175,55,0.4);color:${GOLD};font-weight:700;font-size:13px;text-decoration:none;padding:12px 28px;border-radius:999px;margin:0 8px 10px">Shop Now</a>
      </div>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0">Create or sign in to your Pepscore Lab account, then apply this code at checkout on your first qualifying order.</p>
    </div>
  </div>
</body>
</html>`
}
