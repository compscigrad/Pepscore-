// Pure "which shipment is the primary one" derivation — never a stored
// pointer, so it can't drift out of sync with the real Shipment collection.
// An invoice can have many shipments (split packages, a replaced tracking
// number, a voided label that was never used); the primary one is whichever
// non-voided shipment was created most recently, or — if every shipment on
// the invoice has been voided — the single most recently created one, so
// there's still something sensible to show rather than nothing.
import type { Shipment } from '@prisma/client'

export function getPrimaryShipment<T extends Pick<Shipment, 'createdAt' | 'voidedAt'>>(
  shipments: T[]
): T | null {
  if (shipments.length === 0) return null

  const active = shipments.filter((s) => !s.voidedAt)
  const pool = active.length > 0 ? active : shipments

  return pool.reduce((latest, current) => (current.createdAt > latest.createdAt ? current : latest))
}
