import { describe, it, expect } from 'vitest'
import { checkTrackingNumberFormat } from './validation'

describe('checkTrackingNumberFormat', () => {
  it('flags a missing tracking number', () => {
    const result = checkTrackingNumberFormat('USPS', '')
    expect(result.looksValid).toBe(false)
    expect(result.warning).toBeTruthy()
  })

  it('accepts a well-formed USPS tracking number', () => {
    const result = checkTrackingNumberFormat('USPS', '9400111899223197428490')
    expect(result.looksValid).toBe(true)
  })

  it('accepts a well-formed UPS tracking number', () => {
    const result = checkTrackingNumberFormat('UPS', '1Z999AA10123456784')
    expect(result.looksValid).toBe(true)
  })

  it('accepts a well-formed FedEx tracking number', () => {
    const result = checkTrackingNumberFormat('FEDEX', '123456789012')
    expect(result.looksValid).toBe(true)
  })

  it('warns but does not block on an unusual format, per spec ("never block a save")', () => {
    const result = checkTrackingNumberFormat('UPS', 'not-a-real-tracking-number')
    expect(result.looksValid).toBe(false)
    expect(result.warning).toContain('UPS')
  })

  it('never warns for a carrier with no known format (e.g. PICKUP)', () => {
    const result = checkTrackingNumberFormat('PICKUP', 'anything-goes-here')
    expect(result.looksValid).toBe(true)
    expect(result.warning).toBeUndefined()
  })
})
