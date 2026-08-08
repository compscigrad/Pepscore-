// GET /api/promotions/first-order-offer — public, unauthenticated. Tells
// the storefront banner (components/storefront/FirstOrderOfferBanner.tsx)
// whether to render at all. Deliberately returns only what a visitor needs
// to see the offer, never eligibleProductSlugs/stackable/updatedBy — those
// stay admin-only (app/api/admin/promotions/first-order-offer/route.ts).
import { NextResponse } from 'next/server'
import { getFirstOrderOfferConfig, isFirstOrderOfferLive } from '@/lib/promotions/firstOrderOffer'

export async function GET() {
  const config = await getFirstOrderOfferConfig()
  return NextResponse.json({
    live: isFirstOrderOfferLive(config),
    percentage: config.percentage,
  })
}
