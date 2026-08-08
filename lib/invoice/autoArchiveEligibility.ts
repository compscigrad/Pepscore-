// Pure eligibility check for the auto-archive sweep (lib/invoices.ts's
// sweepAutoArchive), extracted so the rule itself -- paid AND delivered,
// no active backorder, no refund still in flight, countdown anchored on
// the LATER of paidAt or the primary shipment's deliveredAt -- can be unit
// tested without touching the database. Mirrors the
// isAutomaticCompensationEligible/computeCompensationSplit split in
// lib/invoice/backorder.ts: business logic here, Prisma I/O in the caller.
import { getPrimaryShipment } from '@/lib/shipments/primary'
import type { RefundStatus } from '@prisma/client'

const NON_TERMINAL_REFUND_STATUSES: RefundStatus[] = ['PENDING', 'AWAITING_MANUAL_PROCESSING', 'PROCESSING']

export interface AutoArchiveCandidate {
  paidAt: Date | null
  shipments: { createdAt: Date; voidedAt: Date | null; deliveredAt: Date | null }[]
  backorderConditions: { status: string }[]
  refunds: { status: RefundStatus }[]
}

export function isEligibleForAutoArchive(invoice: AutoArchiveCandidate, cutoff: Date): boolean {
  if (invoice.backorderConditions.some((b) => b.status === 'ACTIVE')) return false
  if (invoice.refunds.some((r) => NON_TERMINAL_REFUND_STATUSES.includes(r.status))) return false

  const anchor = autoArchiveAnchorDate(invoice)
  return anchor !== null && anchor <= cutoff
}

// The later of paidAt or the primary (non-voided, most recent) shipment's
// deliveredAt -- never invents a date that isn't on the record: falls back
// to paidAt alone when no shipment carries a deliveredAt.
export function autoArchiveAnchorDate(invoice: Pick<AutoArchiveCandidate, 'paidAt' | 'shipments'>): Date | null {
  const primaryShipment = getPrimaryShipment(invoice.shipments)
  if (invoice.paidAt && primaryShipment?.deliveredAt && primaryShipment.deliveredAt > invoice.paidAt) {
    return primaryShipment.deliveredAt
  }
  return invoice.paidAt
}
