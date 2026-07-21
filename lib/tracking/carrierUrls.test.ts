import { describe, it, expect } from 'vitest'
import { buildCarrierTrackingUrl } from './carrierUrls'

describe('buildCarrierTrackingUrl', () => {
  it('builds a USPS tracking URL', () => {
    expect(buildCarrierTrackingUrl('USPS', '9400111899223197428490')).toContain('usps.com')
  })

  it('builds a UPS tracking URL', () => {
    expect(buildCarrierTrackingUrl('UPS', '1Z999AA10123456784')).toContain('ups.com')
  })

  it('builds a FedEx tracking URL', () => {
    expect(buildCarrierTrackingUrl('FEDEX', '123456789012')).toContain('fedex.com')
  })

  it('builds a DHL tracking URL', () => {
    expect(buildCarrierTrackingUrl('DHL', '1234567890')).toContain('dhl.com')
  })

  it('falls back to a search URL for a non-trackable carrier', () => {
    expect(buildCarrierTrackingUrl('OTHER', 'whatever')).toContain('google.com')
  })

  it('URL-encodes the tracking number', () => {
    expect(buildCarrierTrackingUrl('USPS', 'abc def')).toContain('abc%20def')
  })
})
