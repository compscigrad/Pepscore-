// Real-payment kill switch for the public storefront checkout. Fails closed:
// unset, empty, or anything other than the literal string 'true' means
// disabled. This is the one flag that must flip to actually start charging
// real cards -- everything else about the storefront (browsing, cart,
// product pages) works regardless of this value.
export function isStorefrontCheckoutEnabled(): boolean {
  return process.env.STOREFRONT_CHECKOUT_ENABLED === 'true'
}

export const STOREFRONT_CHECKOUT_DISABLED_MESSAGE =
  'Online ordering is coming soon. In the meantime, contact us to place an order.'
