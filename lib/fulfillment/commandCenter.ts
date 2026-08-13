// Fulfillment Command Center — pure bucket derivation (2026-08-13). No DB
// access here; the DB-querying assembly function lives at the bottom of
// this file and the alert-reconciliation service lives in
// lib/fulfillment/alerts.ts. Reuses the same "paid enough" definition as
// lib/fulfillment/gate.ts's checkFulfillmentEligibility() (balanceDue<=0 OR
// an active payment arrangement) but deliberately does NOT reuse that
// function's backorder short-circuit -- the gate answers "can we ship right
// now," this answers "should this order be in the operational queue at
// all," and a backordered-but-paid order must stay visible/actionable
// (explicit spec requirement), not silently excluded.
import { prisma } from '@/lib/prisma'
import { getPrimaryShipment } from '@/lib/shipments/primary'
import { getFulfillmentSettings } from '@/lib/fulfillment/settings'
import type { Shipment, ShippingStatus, InvoiceStatus } from '@prisma/client'

export type FulfillmentBucket =
  | 'NOT_APPLICABLE' // not paid enough yet, or invoice cancelled/void -- excluded from the queue
  | 'NEEDS_FULFILLMENT' // paid, no shipment yet, still within the label-needed grace window
  | 'LABEL_NEEDED' // paid, no shipment yet, grace window exceeded -- alert-triggering
  | 'AWAITING_CARRIER_SCAN' // label/tracking exists, no carrier acceptance yet, within grace window
  | 'IN_TRANSIT' // carrier has accepted and there's been recent movement
  | 'STALLED' // label-with-no-scan or in-transit-with-no-movement, past its threshold
  | 'EXCEPTION' // carrier exception/returned/lost, or a shipment exists on a since-refunded/cancelled/voided invoice
  | 'DELIVERED'

const AWAITING_SCAN_STATUSES: ShippingStatus[] = ['NOT_SHIPPED', 'TRACKING_ADDED', 'LABEL_CREATED', 'CARRIER_AWAITING_PACKAGE']
const MOVING_STATUSES: ShippingStatus[] = ['ACCEPTED_BY_CARRIER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'AVAILABLE_FOR_PICKUP', 'DELIVERY_ATTEMPTED']
const EXCEPTION_STATUSES: ShippingStatus[] = ['DELAYED', 'DELIVERY_EXCEPTION', 'RETURNED_TO_SENDER', 'LOST']
const REFUNDED_OR_CANCELLED_INVOICE: InvoiceStatus[] = ['CANCELLED', 'VOID', 'REFUNDED']

export interface FulfillmentBucketInput {
  balanceDue: number
  invoiceStatus: InvoiceStatus
  paidAt: Date | null
  hasActivePaymentArrangement: boolean
  hasActiveBackorder: boolean
  shipment: {
    normalizedStatus: ShippingStatus
    // The best available "when did this leg start" timestamp for the
    // current phase -- dateShipped for the awaiting-scan phase (label
    // purchase time), lastEventAt for the in-transit phase (most recent
    // real carrier event). Falls back to null if genuinely unknown --
    // never fabricated.
    phaseStartedAt: Date | null
    monitoringActive: boolean
    voidedAt: Date | null
  } | null
  thresholds: {
    labelNeededHours: number
    awaitingScanHours: number
    stalledInTransitHours: number
  }
  now: number // Date.now() — injected for deterministic testing
}

function hoursSince(date: Date | null, now: number): number | null {
  if (!date) return null
  return (now - date.getTime()) / (1000 * 60 * 60)
}

export function deriveFulfillmentBucket(input: FulfillmentBucketInput): FulfillmentBucket {
  const isPaidEnough = input.balanceDue <= 0 || input.hasActivePaymentArrangement

  // A shipment that exists on an invoice that was later refunded/cancelled/
  // voided is always an EXCEPTION, regardless of the shipment's own status
  // -- money moved backward after a package moved forward, which always
  // needs a human look (spec #39: "surface the exception rather than
  // silently clearing it").
  if (input.shipment && REFUNDED_OR_CANCELLED_INVOICE.includes(input.invoiceStatus) && input.shipment.monitoringActive) {
    return 'EXCEPTION'
  }

  if (!isPaidEnough || REFUNDED_OR_CANCELLED_INVOICE.includes(input.invoiceStatus)) {
    return 'NOT_APPLICABLE'
  }

  if (!input.shipment) {
    const ageHours = hoursSince(input.paidAt, input.now)
    if (ageHours !== null && ageHours >= input.thresholds.labelNeededHours) return 'LABEL_NEEDED'
    return 'NEEDS_FULFILLMENT'
  }

  const { normalizedStatus, phaseStartedAt } = input.shipment

  if (normalizedStatus === 'DELIVERED') return 'DELIVERED'
  if (normalizedStatus === 'CANCELLED') return 'NOT_APPLICABLE'
  if (EXCEPTION_STATUSES.includes(normalizedStatus)) return 'EXCEPTION'

  if (AWAITING_SCAN_STATUSES.includes(normalizedStatus)) {
    const ageHours = hoursSince(phaseStartedAt, input.now)
    if (ageHours !== null && ageHours >= input.thresholds.awaitingScanHours) return 'STALLED'
    return 'AWAITING_CARRIER_SCAN'
  }

  if (MOVING_STATUSES.includes(normalizedStatus)) {
    const ageHours = hoursSince(phaseStartedAt, input.now)
    if (ageHours !== null && ageHours >= input.thresholds.stalledInTransitHours) return 'STALLED'
    return 'IN_TRANSIT'
  }

  // UNKNOWN or any future enum value not yet mapped above -- surfaced as a
  // real exception rather than silently falling into a misleading bucket.
  return 'EXCEPTION'
}

export const BUCKET_LABEL: Record<FulfillmentBucket, string> = {
  NOT_APPLICABLE: 'Not Applicable',
  NEEDS_FULFILLMENT: 'Needs Fulfillment',
  LABEL_NEEDED: 'Label Needed',
  AWAITING_CARRIER_SCAN: 'Awaiting Carrier Scan',
  IN_TRANSIT: 'In Transit',
  STALLED: 'Stalled / Needs Attention',
  EXCEPTION: 'Exception',
  DELIVERED: 'Delivered',
}

// Buckets that represent genuine, current risk -- used both for the
// dashboard's "Needs Attention" count and the queue's default sort/filter.
export const ACTIONABLE_BUCKETS: FulfillmentBucket[] = ['LABEL_NEEDED', 'STALLED', 'EXCEPTION']

export interface FulfillmentQueueRow {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  customerId: string | null
  invoiceStatus: InvoiceStatus
  paidAt: Date | null
  balanceDue: number
  total: number
  itemCount: number
  bucket: FulfillmentBucket
  hasActiveBackorder: boolean
  shipment: Shipment | null
  ageHours: number | null // age of the CURRENT bucket/phase, not always paidAt -- matches what's actually shown ("Paid 2h ago" vs "No movement for 36h")
}

// Fetches every invoice that could plausibly need a queue row: paid enough
// (balanceDue<=0 OR active arrangement) OR has an unresolved shipment that
// might still need EXCEPTION surfacing after a refund. Bucket computation
// itself (including the NOT_APPLICABLE exclusion) happens in-memory via the
// pure function above so there's exactly one source of truth for the rule.
export async function listFulfillmentQueue(now: number = Date.now()): Promise<FulfillmentQueueRow[]> {
  const settings = await getFulfillmentSettings()

  const invoices = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      // Broad candidate net -- an APPROVED arrangement here doesn't yet
      // mean "active" (that also requires a still-PENDING installment,
      // checked precisely per-row below via the same rule
      // hasActivePaymentArrangement() itself uses); widening the net this
      // way is harmless since the bucket derivation excludes anything that
      // doesn't actually qualify.
      OR: [{ balanceDue: { lte: 0 } }, { paymentArrangement: { status: 'APPROVED' } }, { shipments: { some: { monitoringActive: true } } }],
    },
    include: {
      shipments: true,
      items: { select: { id: true } },
      backorderConditions: { where: { status: 'ACTIVE' }, select: { id: true } },
      paymentArrangement: {
        select: { status: true, installments: { where: { status: 'PENDING' }, select: { id: true }, take: 1 } },
      },
    },
    orderBy: { paidAt: 'asc' },
  })

  return invoices.map((invoice) => {
    const primary = getPrimaryShipment(invoice.shipments)
    // Mirrors lib/paymentArrangements.ts's hasActivePaymentArrangement()
    // exactly (APPROVED status + at least one PENDING installment) --
    // computed per-row here instead of calling that function again per
    // invoice, since the installment data is already fetched above.
    const hasActiveArrangement = invoice.paymentArrangement?.status === 'APPROVED' && (invoice.paymentArrangement?.installments.length ?? 0) > 0
    const hasBackorder = invoice.backorderConditions.length > 0

    const shipmentInput = primary
      ? {
          normalizedStatus: primary.normalizedStatus,
          phaseStartedAt: primary.lastEventAt ?? primary.dateShipped ?? primary.purchasedAt ?? null,
          monitoringActive: primary.monitoringActive,
          voidedAt: primary.voidedAt,
        }
      : null

    const bucket = deriveFulfillmentBucket({
      balanceDue: invoice.balanceDue,
      invoiceStatus: invoice.status,
      paidAt: invoice.paidAt,
      hasActivePaymentArrangement: hasActiveArrangement,
      hasActiveBackorder: hasBackorder,
      shipment: shipmentInput,
      thresholds: {
        labelNeededHours: settings.labelNeededHours,
        awaitingScanHours: settings.awaitingScanHours,
        stalledInTransitHours: settings.stalledInTransitHours,
      },
      now,
    })

    const ageHours = shipmentInput
      ? hoursSince(shipmentInput.phaseStartedAt, now)
      : hoursSince(invoice.paidAt, now)

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerId: invoice.customerId,
      invoiceStatus: invoice.status,
      paidAt: invoice.paidAt,
      balanceDue: invoice.balanceDue,
      total: invoice.total,
      itemCount: invoice.items.length,
      bucket,
      hasActiveBackorder: hasBackorder,
      shipment: primary,
      ageHours,
    }
  }).filter((row) => row.bucket !== 'NOT_APPLICABLE')
}
