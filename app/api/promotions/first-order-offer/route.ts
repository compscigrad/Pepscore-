// GET /api/promotions/first-order-offer — public, unauthenticated. Tells
// the storefront banner/modal whether to render at all, and the current
// campaign's customer-facing copy/discount shape. Deliberately returns
// only what a visitor needs to see the offer, never eligibleProductSlugs/
// internal campaign name/admin fields — those stay admin-only
// (app/api/admin/promotion-campaigns).
import { NextResponse } from 'next/server'
import { getActiveFirstOrderOffer } from '@/lib/promotions/firstOrderOffer'

export async function GET() {
  const offer = await getActiveFirstOrderOffer()
  if (!offer.live || !offer.campaign) {
    return NextResponse.json({ live: false })
  }
  return NextResponse.json({
    live: true,
    publicTitle: offer.campaign.publicTitle,
    publicDescription: offer.campaign.publicDescription,
    discountType: offer.campaign.discountType,
    discountValue: offer.campaign.discountValue,
  })
}
