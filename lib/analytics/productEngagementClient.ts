'use client'

// AI-1.2 -- fires the first-party product-engagement beacon from client
// components. Uses navigator.sendBeacon when available so a fast
// navigation right after the call (e.g. add-to-cart immediately followed
// by opening the cart) doesn't risk the request being cancelled
// mid-flight; falls back to a keepalive fetch for environments/browsers
// without sendBeacon (or in a test/jsdom environment where it's absent).
// Best-effort only, matching lib/analytics/track.ts's trackEvent() -- a
// failure here must never affect the real product-view or add-to-cart
// action it's observing.
export interface ProductEngagementPayload {
  productId: string
  productName: string
  category?: string
  eventType: 'VIEW' | 'ADD_TO_CART'
}

const ENDPOINT = '/api/analytics/product-engagement'

export function trackProductEngagement(payload: ProductEngagementPayload): void {
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  } catch {
    // Best-effort only.
  }
}
