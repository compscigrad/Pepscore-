// Central catalog of analytics event names (Phase 4 production-readiness:
// the AOAI flagship-alignment audit found zero visitor/funnel analytics
// anywhere in the app). Every event fired anywhere in this codebase should
// use a name from here, not an inline string, so the funnel can't silently
// drift between what's tracked and what's documented.
//
// Hard rule for every call site that fires one of these: properties may
// only ever be non-identifying values (slugs, categories, enum-like
// strings, counts, monetary amounts). Never pass email, name, phone,
// address, or any other value that identifies a specific person -- see
// lib/analytics/track.ts and lib/analytics/serverTrack.ts.
export const AnalyticsEvent = {
  PRODUCT_VIEW: 'product_view',
  SEARCH: 'search',
  ADD_TO_CART: 'add_to_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  PROMOTION_APPLIED: 'promotion_applied',
  LEAD_CAPTURE_SUBMIT: 'lead_capture_submit',
  PROMOTION_CLAIM: 'promotion_claim',
  ACCOUNT_CREATED: 'account_created',
  ORDER_PAID: 'order_paid',
  PORTAL_ACTIVATION: 'portal_activation',
  BUY_AGAIN: 'buy_again',
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

// Pageviews (including the storefront landing page) and Core Web Vitals
// are already covered automatically by <Analytics /> (@vercel/analytics/next,
// mounted in app/layout.tsx) -- no custom "landing_page_visit" event needed.
//
// "Checkout abandoned" is deliberately not a client-side event here: a
// reliable signal already exists server-side in
// app/api/cron/release-abandoned-reservations/route.ts (every reservation
// it releases is, by definition, an abandoned checkout), and a
// beforeunload/visibility-based client event would be both unreliable and
// easy to over-engineer for a metric the backend already counts correctly.
