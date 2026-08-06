import { describe, it, expect, afterEach } from 'vitest'
import { isPortalEnabled } from './portalAuth'

describe('isPortalEnabled', () => {
  const original = process.env.PORTAL_ENABLED

  afterEach(() => {
    if (original === undefined) delete process.env.PORTAL_ENABLED
    else process.env.PORTAL_ENABLED = original
  })

  it('defaults to disabled when unset — the portal stays fully inert with no action needed', () => {
    delete process.env.PORTAL_ENABLED
    expect(isPortalEnabled()).toBe(false)
  })

  it('stays disabled for any value other than the literal string "true"', () => {
    process.env.PORTAL_ENABLED = 'false'
    expect(isPortalEnabled()).toBe(false)
    process.env.PORTAL_ENABLED = '1'
    expect(isPortalEnabled()).toBe(false)
  })

  it('is enabled only once explicitly flipped to "true"', () => {
    process.env.PORTAL_ENABLED = 'true'
    expect(isPortalEnabled()).toBe(true)
  })
})
