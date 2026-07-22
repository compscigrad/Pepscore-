import { describe, it, expect } from 'vitest'
import { getPrimaryShipment } from './primary'

function shipment(id: string, createdAt: string, voidedAt: string | null = null) {
  return { id, createdAt: new Date(createdAt), voidedAt: voidedAt ? new Date(voidedAt) : null }
}

describe('getPrimaryShipment', () => {
  it('returns null for an empty list', () => {
    expect(getPrimaryShipment([])).toBeNull()
  })

  it('returns the only shipment when there is one', () => {
    const s = shipment('a', '2026-01-01')
    expect(getPrimaryShipment([s])).toBe(s)
  })

  it('returns the most recently created non-voided shipment', () => {
    const older = shipment('a', '2026-01-01')
    const newer = shipment('b', '2026-01-05')
    expect(getPrimaryShipment([older, newer])).toBe(newer)
    expect(getPrimaryShipment([newer, older])).toBe(newer)
  })

  it('skips voided shipments in favor of an active one, regardless of recency', () => {
    const voided = shipment('a', '2026-01-10', '2026-01-11')
    const active = shipment('b', '2026-01-05')
    expect(getPrimaryShipment([voided, active])).toBe(active)
  })

  it('falls back to the most recent shipment if all are voided', () => {
    const older = shipment('a', '2026-01-01', '2026-01-02')
    const newer = shipment('b', '2026-01-05', '2026-01-06')
    expect(getPrimaryShipment([older, newer])).toBe(newer)
  })
})
