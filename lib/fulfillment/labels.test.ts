import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isShippoPurchasingEnabled, isShippoConfigured } from './labels'

describe('isShippoPurchasingEnabled', () => {
  const original = process.env.SHIPPO_PURCHASING_ENABLED

  afterEach(() => {
    if (original === undefined) delete process.env.SHIPPO_PURCHASING_ENABLED
    else process.env.SHIPPO_PURCHASING_ENABLED = original
  })

  it('defaults to disabled when unset — the Trust & Safety hold stays on without any action needed', () => {
    delete process.env.SHIPPO_PURCHASING_ENABLED
    expect(isShippoPurchasingEnabled()).toBe(false)
  })

  it('stays disabled for any value other than the literal string "true"', () => {
    process.env.SHIPPO_PURCHASING_ENABLED = 'false'
    expect(isShippoPurchasingEnabled()).toBe(false)
    process.env.SHIPPO_PURCHASING_ENABLED = '1'
    expect(isShippoPurchasingEnabled()).toBe(false)
  })

  it('is enabled only once explicitly flipped to "true"', () => {
    process.env.SHIPPO_PURCHASING_ENABLED = 'true'
    expect(isShippoPurchasingEnabled()).toBe(true)
  })
})

describe('isShippoConfigured', () => {
  const original = process.env.SHIPPO_API_KEY

  beforeEach(() => {
    delete process.env.SHIPPO_API_KEY
  })

  afterEach(() => {
    if (original === undefined) delete process.env.SHIPPO_API_KEY
    else process.env.SHIPPO_API_KEY = original
  })

  it('is false with no key present', () => {
    expect(isShippoConfigured()).toBe(false)
  })

  it('is true once a key is present, independent of the purchasing kill-switch', () => {
    process.env.SHIPPO_API_KEY = 'shippo_test_whatever'
    expect(isShippoConfigured()).toBe(true)
  })
})
