// POST /api/promotions/validate-code — pure preview/validation for the
// cart/checkout promo-code field (Phase 4A Critical #1). Safe to call
// repeatedly (every keystroke-debounced apply attempt) -- never writes
// anything, never touches PromotionCode.status. The actual application
// happens at checkout creation (app/api/checkout/route.ts), which
// re-validates authoritatively rather than trusting this endpoint's result.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { resolveCustomerIdForCheckout, resolvePromotionCode, PROMOTION_CODE_INVALID_MESSAGE } from '@/lib/promotions/redemption'

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`promo-validate:${getClientIp(req)}`, 20, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ valid: false, message: 'Too many attempts — please wait a moment and try again.' }, { status: 429 })
  }

  const { userId } = await auth()
  const body = await req.json().catch(() => ({}))
  const { code, email, cartSubtotal, cartProductSlugs } = body as {
    code?: string
    email?: string
    cartSubtotal?: number
    cartProductSlugs?: string[]
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
