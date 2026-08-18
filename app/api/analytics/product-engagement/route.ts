// POST /api/analytics/product-engagement -- public, unauthenticated
// endpoint capturing the first-party product-view/add-to-cart record
// (AI-1.2). Fired from components/storefront/ProductDetail.tsx and
// lib/cart-store.ts, both client-only, alongside (not instead of) the
// existing @vercel/analytics trackEvent() call -- this is a second,
// first-party-only channel, not a replacement.
//
// Public + unauthenticated by necessity (anonymous visitors view products
// too), so rate-limited per IP and schema-validated, matching
// app/api/leads/route.ts's established pattern for public write endpoints.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { logProductEngagement } from '@/lib/analytics/productEngagement'

const productEngagementSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  productName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(200).optional(),
  eventType: z.enum(['VIEW', 'ADD_TO_CART']),
})

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`product-engagement:${getClientIp(req)}`, 60, 60_000)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = productEngagementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await logProductEngagement(parsed.data)
  return NextResponse.json({ ok: true })
}
