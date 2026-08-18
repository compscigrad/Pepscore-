import { describe, it, expect } from 'vitest'
import { parseNotificationMap, isNotificationEnabled } from './invoiceSettings'

describe('parseNotificationMap', () => {
  it('returns the value as-is when it is a plain object', () => {
    expect(parseNotificationMap({ IN_TRANSIT: false, DELIVERED: true })).toEqual({ IN_TRANSIT: false, DELIVERED: true })
  })

  it('returns an empty object for null', () => {
    expect(parseNotificationMap(null)).toEqual({})
  })

  it('returns an empty object for a non-object JSON value (defensive against malformed stored JSON)', () => {
    expect(parseNotificationMap('not-an-object' as never)).toEqual({})
    expect(parseNotificationMap(42 as never)).toEqual({})
  })

  it('returns an empty object for a JSON array (not a valid map shape)', () => {
    expect(parseNotificationMap(['IN_TRANSIT'] as never)).toEqual({})
  })
})

describe('isNotificationEnabled', () => {
  it('is enabled by default when the status key is absent from settings', () => {
    expect(isNotificationEnabled({}, 'IN_TRANSIT')).toBe(true)
  })

  it('is enabled when explicitly set to true', () => {
    expect(isNotificationEnabled({ IN_TRANSIT: true }, 'IN_TRANSIT')).toBe(true)
  })

  it('is disabled only when explicitly set to false', () => {
    expect(isNotificationEnabled({ IN_TRANSIT: false }, 'IN_TRANSIT')).toBe(false)
  })

  it('a false setting for one status does not affect another', () => {
    expect(isNotificationEnabled({ IN_TRANSIT: false }, 'DELIVERED')).toBe(true)
  })
})
