// Central type definitions for Pepscore
import type { SellUnit } from '@/lib/pricing/sellUnits'

export interface CartItem {
  id: string
  slug: string
  name: string
  size: string
  price: number
  imageUrl: string
  quantity: number
  // Snapshotted from the product's availability at the moment it was added
  // -- never re-derived live in the cart (a lightweight client-side store
  // with no server round-trip), so the cart's own indicator/copy can only
  // ever be as fresh as the last add. See lib/storefront/availability.ts.
  backordered?: boolean
  // Phase 3C reorder architecture: which sell-unit tier this line is. Null/
  // undefined means "Standard Case" (the only tier the cart offered before
  // this) -- never assume a value is present when reading an older
  // persisted cart. `price`/`unitsPerSellUnit` here are a snapshot for
  // display only; checkout always re-resolves both from the live product,
  // never trusts what the cart says (see app/api/checkout/route.ts).
  sellUnit?: SellUnit | null
  unitsPerSellUnit?: number | null
}

export interface ShippingAddress {
  name: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
}

export interface CheckoutLineItem {
  productId: string
  name: string
  size: string
  quantity: number
  // Client-supplied unitPrice is never trusted -- app/api/checkout/route.ts
  // always re-resolves the authoritative current price server-side. It's
  // kept here only because the pre-3C client payload already sent it and
  // nothing depends on removing it.
  unitPrice: number
  // Phase 3C: which sell-unit tier this line requests. Omitted/null falls
  // back to Standard Case server-side (lib/storefront/checkoutPricing.ts),
  // matching every pre-existing cart/order.
  sellUnit?: SellUnit | null
}

// Stripe Checkout metadata attached to every session
export interface StripeSessionMetadata {
  orderId: string
  orderNumber: string
  userId?: string
  customerEmail: string
}
