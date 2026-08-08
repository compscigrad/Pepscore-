// Central type definitions for Pepscore

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
  unitPrice: number
}

// Stripe Checkout metadata attached to every session
export interface StripeSessionMetadata {
  orderId: string
  orderNumber: string
  userId?: string
  customerEmail: string
}
