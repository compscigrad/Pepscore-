// POST /api/promotions/validate-code — pure preview/validation for the
// cart/checkout promo-code field (Phase 4A Critical #1). Safe to call
// repeatedly (every keystroke-debounced apply attempt) -- never writes
// anything, never touches PromotionCode.status. The actual application
// happens at checkout creation (app/api/checkout/route.ts), which
// re-validates authoritatively rather than trusting this endpoint's result.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { resolveCustomerIdForCheckout, resolvePromotionCode, PROMOTION_CODE_INVALID_MESSAGE } from '@/lib/promotions/redemption'
import { isBirthdayCodeFormat, resolveBirthdayCodeForCheckout } from '@/lib/pricing/birthdayPromotion'
import { resolveProEligibleByClerkUserId } from '@/lib/storefront/professionalAccess'
import { resolveActivePreferredPricesByClerkUserId, preferredPriceFor } from '@/lib/pricing/preferredPricing'
import { resolveCanonicalPricing, type PricingProduct } from '@/lib/pricing/canonicalPricing'
import type { SellUnit } from '@/lib/pricing/sellUnits'

interface PreviewCartItem {
  productId: string
  sellUnit?: SellUnit | null
  quantity: number
}

// Birthday's locked 15% is computed against the Price-Match-adjusted
// subtotal, never the raw catalog subtotal a generic promo code discounts
// against (see lib/pricing/birthdayPromotion.ts's checkout-integration
// header) -- this re-resolves canonical pricing the same way checkout
// itself will, so this preview never shows a different discount than the
// customer actually gets charged. A resolution failure (stale cart line,
// no-longer-purchasable product) never crashes the preview -- checkout
// re-validates authoritatively and rejects the line there instead.
interface EligibleMerchandiseResolution {
  subtotal: number
  // True only when at least one line actually resolved via an active Price
  // Match authorization -- distinct from the separate, unrelated standard
  // volume-discount ladder, so the checkout UI's "Price Match Subtotal" vs
  // "Eligible Merchandise" wording (locked spec section B6) reflects Price
  // Match specifically, never gets shown just because volume pricing alone
  // happened to lower the subtotal.
  priceMatchApplied: boolean
}

async function resolveEligibleMerchandiseSubtotal(clerkUserId: string | null, items: PreviewCartItem[]): Promise<EligibleMerchandiseResolution> {
  if (items.length === 0) return { subtotal: 0, priceMatchApplied: false }
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } })
  const productMap = new Map<string, PricingProduct & { id: string }>(products.map((p) => [p.id, p]))
  const proEligible = await resolveProEligibleByClerkUserId(clerkUserId)
  const preferredPrices = await resolveActivePreferredPricesByClerkUserId(
    clerkUserId,
    items.map((i) => ({ productId: i.productId, sellUnit: i.sellUnit ?? 'CASE_STANDARD' }))
  )
  try {
    const resolved = resolveCanonicalPricing(
      items
        .filter((i) => productMap.has(i.productId))
        .map((i) => ({
          product: productMap.get(i.productId)!,
          sellUnit: i.sellUnit,
          quantity: i.quantity,
          preferredPrice: preferredPriceFor(preferredPrices, i.productId, i.sellUnit ?? 'CASE_STANDARD'),
        })),
      { proEligible }
    )
    return {
      subtotal: resolved.reduce((sum, line) => sum + line.lineTotal, 0),
      priceMatchApplied: resolved.some((line) => line.pricingSource === 'PRICE_MATCH'),
    }
  } catch {
    return { subtotal: 0, priceMatchApplied: false }
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`promo-validate:${getClientIp(req)}`, 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ valid: false, message: 'Too many attempts — please wait a moment and try again.' }, { status: 429 })
  }

  const { userId } = await auth()
  const body = await req.json().catch(() => ({}))
  const { code, email, cartSubtotal, cartProductSlugs, items } = body as {
    code?: string
    email?: string
    cartSubtotal?: number
    cartProductSlugs?: string[]
    items?: PreviewCartItem[]
  }

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false, message: 'Enter a code.' }, { status: 400 })
  }
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ valid: false, message: 'Enter your email first.' }, { status: 400 })
  }

  const customerId = await resolveCustomerIdForCheckout(userId, email)
  if (!customerId) {
    return NextResponse.json({ valid: false, message: PROMOTION_CODE_INVALID_MESSAGE.WRONG_CUSTOMER })
  }

  if (isBirthdayCodeFormat(code)) {
    const { subtotal: eligibleMerchandiseSubtotal, priceMatchApplied } = await resolveEligibleMerchandiseSubtotal(
      userId ?? null,
      Array.isArray(items) ? items : []
    )
    const result = await resolveBirthdayCodeForCheckout(code, customerId, eligibleMerchandiseSubtotal)
    if (!result.valid) {
      return NextResponse.json({ valid: false, reason: result.reason, message: result.message })
    }
    return NextResponse.json({
      valid: true,
      discountAmount: result.discountAmount,
      campaignTitle: result.label,
      isBirthday: true,
      eligibleMerchandiseSubtotal,
      priceMatchApplied,
    })
  }

  const result = await resolvePromotionCode(code, {
    customerId,
    cartSubtotal: typeof cartSubtotal === 'number' ? cartSubtotal : 0,
    cartProductSlugs: Array.isArray(cartProductSlugs) ? cartProductSlugs : [],
  })

  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason, message: PROMOTION_CODE_INVALID_MESSAGE[result.reason] })
  }

  return NextResponse.json({
    valid: true,
    discountAmount: result.discountAmount,
    campaignTitle: result.campaign.publicTitle,
  })
}
