// Pure acquisition-popup trigger/suppression logic (2026-08-19 lead-
// capture/conversion engine, sections 2-3, 33). Kept free of
// localStorage/DOM access so the actual eligibility rules are unit-
// testable without a browser -- the client component
// (components/storefront/AcquisitionPopup.tsx) is the only place that
// reads/writes localStorage or DOM events, and calls straight into these
// functions for every decision.
export interface AcquisitionPopupState {
  capturedAt?: number
  dismissedAt?: number
}

export interface AcquisitionPopupSuppressionConfig {
  capturedSuppressDays: number
  dismissedSuppressDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Section 3: a successful submission suppresses the popup for a long
// (admin-configurable) period; an explicit dismiss-without-submitting
// suppresses for a shorter one. Captured always wins over dismissed when
// both happen to be set (a captured lead should never be re-prompted just
// because they also dismissed it once beforehand).
export function isPopupSuppressed(state: AcquisitionPopupState, config: AcquisitionPopupSuppressionConfig, now: number): boolean {
  if (state.capturedAt !== undefined) {
    return now - state.capturedAt < config.capturedSuppressDays * DAY_MS
  }
  if (state.dismissedAt !== undefined) {
    return now - state.dismissedAt < config.dismissedSuppressDays * DAY_MS
  }
  return false
}

export function recordCapture(now: number): AcquisitionPopupState {
  return { capturedAt: now }
}

export function recordDismiss(state: AcquisitionPopupState, now: number): AcquisitionPopupState {
  // Never overwrites an existing capturedAt -- a customer who already
  // converted and is merely closing a stray re-render should stay
  // suppressed under the longer captured window, not get downgraded to the
  // shorter dismissed one.
  if (state.capturedAt !== undefined) return state
  return { ...state, dismissedAt: now }
}

export interface AcquisitionPopupTriggerConfig {
  delayMs: number
  scrollThresholdPercent: number | null
  exitIntentEnabled: boolean
}

export interface AcquisitionPopupSignals {
  elapsedMs: number
  scrollPercent: number // 0-100, how far down the page the visitor has scrolled
  exitIntentDetected: boolean
  isDesktop: boolean // exit-intent only ever applies on desktop (section 3: "where reliable")
}

// Any configured trigger firing is sufficient -- "delay OR scroll OR
// exit-intent," not a required combination. A campaign/settings row with
// every trigger disabled (delayMs effectively unreachable is not
// supported -- delay always has a value) still fires once elapsedMs
// crosses delayMs, since delay is the one trigger that's always "enabled"
// by construction; scrollThresholdPercent=null and exitIntentEnabled=false
// simply opt those two out.
export function shouldTriggerPopup(config: AcquisitionPopupTriggerConfig, signals: AcquisitionPopupSignals): boolean {
  if (signals.elapsedMs >= config.delayMs) return true
  if (config.scrollThresholdPercent !== null && signals.scrollPercent >= config.scrollThresholdPercent) return true
  if (config.exitIntentEnabled && signals.isDesktop && signals.exitIntentDetected) return true
  return false
}
