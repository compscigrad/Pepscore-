import { describe, it, expect } from 'vitest'
import { deriveFulfillmentState } from './admin'

describe('deriveFulfillmentState', () => {
  it('returns NONE when there are no reservations at all', () => {
    expect(deriveFulfillmentState([])).toBe('NONE')
  })

  it('returns NONE when every reservation was released (e.g. a cancelled order)', () => {
    expect(deriveFulfillmentState([{ status: 'RELEASED' }, { status: 'RELEASED' }])).toBe('NONE')
  })

  it('returns UNFULFILLED when every reservation is still ACTIVE', () => {
    expect(deriveFulfillmentState([{ status: 'ACTIVE' }, { status: 'ACTIVE' }])).toBe('UNFULFILLED')
  })

  it('returns FULFILLED when every reservation is FULFILLED', () => {
    expect(deriveFulfillmentState([{ status: 'FULFILLED' }, { status: 'FULFILLED' }])).toBe('FULFILLED')
  })

  it('returns PARTIALLY_FULFILLED when some lines shipped and others are still outstanding', () => {
    expect(deriveFulfillmentState([{ status: 'FULFILLED' }, { status: 'ACTIVE' }])).toBe('PARTIALLY_FULFILLED')
  })

  it('never reports FULFILLED for a mix that includes a RELEASED line alongside an ACTIVE one', () => {
    expect(deriveFulfillmentState([{ status: 'RELEASED' }, { status: 'ACTIVE' }])).toBe('UNFULFILLED')
  })
})
