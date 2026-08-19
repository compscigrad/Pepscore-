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
  // Added 2026-08-12 (AOAI flagship lead-capture/conversion sprint) --
  // funnel-stage events the offer/sign-in flow previously had no
  // visibility into (only the terminal submit/claim actions were tracked).
  OFFER_VIEWED: 'offer_viewed',
  OFFER_RECOVERY_SHOWN: 'offer_recovery_shown',
  CLIENT_SIGN_IN_CLICK: 'client_sign_in_click',
  COACH_MARK_IMPRESSION: 'coach_mark_impression',
  COACH_MARK_CLICK: 'coach_mark_click',
  // Added 2026-08-12 (pre-signup RUO/21+ gate) -- ACCOUNT_CREATED above
  // already covers "Clerk signup completed / customer account created"
  // (fired server-side from the Clerk webhook, lib/portal/accessEvents.ts),
  // so only the gate's own steps needed new events.
  SIGNUP_GATE_SHOWN: 'signup_gate_shown',
  SIGNUP_GATE_ACCEPTED: 'signup_gate_accepted',
  SIGNUP_GATE_ABANDONED: 'signup_gate_abandoned',
  // Added 2026-08-15 (fulfillment/availability sprint) -- visibility into
  // Produced-to-Order demand and Special Request interest, so a future
  // admin insight ("this variant was produced to order N times in the last
  // 30 days") has real signal to work from rather than being designed
  // against data that doesn't exist yet.
  PRODUCED_TO_ORDER_VIEWED: 'produced_to_order_viewed',
  SINGLE_VIAL_SPECIAL_REQUEST_CLICKED: 'single_vial_special_request_clicked',
  // Added 2026-08-19 (lead-capture/conversion engine) -- distinguishes an
  // auto-triggered popup actually rendering (impression) from a visitor
  // closing it without submitting (dismissed). OFFER_VIEWED above still
  // fires for the manual "Claim X% →" trigger button; these two are
  // popup-lifecycle-specific and also dual-logged server-side as
  // CampaignFunnelEvent rows (lib/promotions/funnelEvents.ts) so the Admin
  // conversion dashboard has real, queryable numbers.
  LEAD_POPUP_IMPRESSION: 'lead_popup_impression',
  LEAD_POPUP_DISMISSED: 'lead_popup_dismissed',
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
