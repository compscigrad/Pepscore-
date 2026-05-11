// Central type definitions for Pepscore

export interface CartItem {
  id: string
  slug: string
  name: string
  size: string
  price: number
  imageUrl: string
  quantity: number
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
