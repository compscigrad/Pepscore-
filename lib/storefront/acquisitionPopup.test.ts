import { describe, it, expect } from 'vitest'
import { isPopupSuppressed, recordCapture, recordDismiss, shouldTriggerPopup } from './acquisitionPopup'

const DAY_MS = 24 * 60 * 60 * 1000
const suppressionConfig = { capturedSuppressDays: 90, dismissedSuppressDays: 7 }

describe('isPopupSuppressed', () => {
  it('is not suppressed with no prior state', () => {
    expect(isPopupSuppressed({}, suppressionConfig, Date.now())).toBe(false)
  })

  it('suppresses within the captured window', () => {
    const now = 1000 * DAY_MS
    const state = { capturedAt: now - 10 * DAY_MS }
    expect(isPopupSuppressed(state, suppressionConfig, now)).toBe(true)
  })

  it('stops suppressing once the captured window elapses', () => {
    const now = 1000 * DAY_MS
    const state = { capturedAt: now - 91 * DAY_MS }
    expect(isPopupSuppressed(state, suppressionConfig, now)).toBe(false)
  })

  it('suppresses within the shorter dismissed window', () => {
    const now = 1000 * DAY_MS
    const state = { dismissedAt: now - 3 * DAY_MS }
    expect(isPopupSuppressed(state, suppressionConfig, now)).toBe(true)
  })

  it('stops suppressing once the dismissed window elapses', () => {
    const now = 1000 * DAY_MS
    const state = { dismissedAt: now - 8 * DAY_MS }
    expect(isPopupSuppressed(state, suppressionConfig, now)).toBe(false)
  })

  it('a captured state always wins over a stale dismissed state, even outside the captured window is checked first', () => {
    const now = 1000 * DAY_MS
    // Captured is old enough to no longer suppress on its own, but a
    // dismissedAt existing alongside it must never be consulted --
    // capturedAt is the authoritative signal once it exists.
    const state = { capturedAt: now - 91 * DAY_MS, dismissedAt: now - 1 * DAY_MS }
    expect(isPopupSuppressed(state, suppressionConfig, now)).toBe(false)
  })
})

describe('recordCapture / recordDismiss', () => {
  it('recordCapture sets capturedAt', () => {
    expect(recordCapture(500).capturedAt).toBe(500)
  })

  it('recordDismiss sets dismissedAt on fresh state', () => {
    expect(recordDismiss({}, 500).dismissedAt).toBe(500)
  })

  it('recordDismiss never downgrades an existing capturedAt', () => {
    const state = { capturedAt: 100 }
    expect(recordDismiss(state, 500)).toEqual({ capturedAt: 100 })
  })
})

describe('shouldTriggerPopup', () => {
  const baseSignals = { elapsedMs: 0, scrollPercent: 0, exitIntentDetected: false, isDesktop: true }

  it('fires once the delay elapses', () => {
    const config = { delayMs: 8000, scrollThresholdPercent: null, exitIntentEnabled: false }
    expect(shouldTriggerPopup(config, { ...baseSignals, elapsedMs: 7999 })).toBe(false)
    expect(shouldTriggerPopup(config, { ...baseSignals, elapsedMs: 8000 })).toBe(true)
  })

  it('fires on scroll threshold even before the delay elapses', () => {
    const config = { delayMs: 60000, scrollThresholdPercent: 50, exitIntentEnabled: false }
    expect(shouldTriggerPopup(config, { ...baseSignals, elapsedMs: 100, scrollPercent: 49 })).toBe(false)
    expect(shouldTriggerPopup(config, { ...baseSignals, elapsedMs: 100, scrollPercent: 50 })).toBe(true)
  })

  it('scroll trigger never fires when scrollThresholdPercent is null (disabled)', () => {
    const config = { delayMs: 60000, scrollThresholdPercent: null, exitIntentEnabled: false }
    expect(shouldTriggerPopup(config, { ...baseSignals, elapsedMs: 100, scrollPercent: 100 })).toBe(false)
  })

  it('fires on exit intent when enabled and on desktop', () => {
    const config = { delayMs: 60000, scrollThresholdPercent: null, exitIntentEnabled: true }
    expect(shouldTriggerPopup(config, { ...baseSignals, exitIntentDetected: true, isDesktop: true })).toBe(true)
  })

  it('never fires on exit intent on a non-desktop device, even when enabled and detected', () => {
    const config = { delayMs: 60000, scrollThresholdPercent: null, exitIntentEnabled: true }
    expect(shouldTriggerPopup(config, { ...baseSignals, exitIntentDetected: true, isDesktop: false })).toBe(false)
  })

  it('never fires on exit intent when the trigger itself is disabled', () => {
    const config = { delayMs: 60000, scrollThresholdPercent: null, exitIntentEnabled: false }
    expect(shouldTriggerPopup(config, { ...baseSignals, exitIntentDetected: true, isDesktop: true })).toBe(false)
  })
})
