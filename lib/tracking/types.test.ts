import { describe, it, expect } from 'vitest'
import { isTrackableCarrier } from './types'

describe('isTrackableCarrier', () => {
  it('treats USPS/UPS/FEDEX/DHL as trackable', () => {
    expect(isTrackableCarrier('USPS')).toBe(true)
    expect(isTrackableCarrier('UPS')).toBe(true)
    expect(isTrackableCarrier('FEDEX')).toBe(true)
    expect(isTrackableCarrier('DHL')).toBe(true)
  })

  it('treats PICKUP/HAND_DELIVERY/COURIER/OTHER as not trackable (unsupported carrier for automated tracking)', () => {
    expect(isTrackableCarrier('PICKUP')).toBe(false)
    expect(isTrackableCarrier('HAND_DELIVERY')).toBe(false)
    expect(isTrackableCarrier('COURIER')).toBe(false)
    expect(isTrackableCarrier('OTHER')).toBe(false)
  })
})
