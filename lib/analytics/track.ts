'use client'

// Client-side event tracking -- thin wrapper over @vercel/analytics' own
// track() so every call site in this app goes through one place that (a)
// only accepts the safe property-value shape and (b) never throws if
// Analytics isn't mounted (e.g. local dev without a Vercel project linked).
import { track } from '@vercel/analytics'
import type { AnalyticsEventName } from './events'

export type SafeEventProperties = Record<string, string | number | boolean | null>

export function trackEvent(name: AnalyticsEventName, properties?: SafeEventProperties): void {
  try {
    void track(name, properties)
  } catch {
    // Best-effort only -- an analytics failure must never break a real
    // customer action (add to cart, checkout, lead capture, etc.).
  }
}
