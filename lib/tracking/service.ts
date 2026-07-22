// Core tracking service — the only module that mutates Shipment/TrackingEvent/
// InvoiceActivityLog rows or talks to a ShippingProvider. Invoice routes and
// UI call these functions; nothing else touches lib/tracking's internals or
// Prisma tables directly.
import { Prisma } from '@prisma/client'
import type { ShippingCarrier, ShippingStatus, TrackingEventSource, DeliveryStatus, ShipmentOrigin, Shipment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getProviderForCarrier } from './registry'
import { isTrackableCarrier } from './types'
import type { NormalizedTrackingEvent } from './types'
import { buildCarrierTrackingUrl } from './carrierUrls'
import { checkTrackingNumberFormat } from './validation'
import { computeEventHash } from './eventHash'
import { sanitizeCarrierText } from './sanitize'
import { computeOrderStatus } from './orderStatus'
import { sendShipmentNotificationIfNeeded } from './notifications'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'
import { getPrimaryShipment } from '@/lib/shipments/primary'

const TERMINAL_STATUSES: ShippingStatus[] = ['DELIVERED', 'RETURNED_TO_SENDER', 'LOST', 'CANCELLED']

// Legacy DeliveryStatus mapping so the pre-existing deliveryStatus field
// (used by older invoices and the existing dashboard/PDF display) stays
// sensible even though the tracking system now drives shippingStatus
// instead. Not every new status has a clean 1:1 legacy equivalent — those
// fall back to whatever's closest.
const LEGACY_DELIVERY_STATUS: Record<ShippingStatus, DeliveryStatus> = {
  NOT_SHIPPED: 'PREPARING',
  TRACKING_ADDED: 'PACKED',
  LABEL_CREATED: 'PACKED',
  CARRIER_AWAITING_PACKAGE: 'PACKED',
  ACCEPTED_BY_CARRIER: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELAYED: 'IN_TRANSIT',
  DELIVERY_EXCEPTION: 'IN_TRANSIT',
  AVAILABLE_FOR_PICKUP: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  RETURNED_TO_SENDER: 'RETURNED',
  DELIVERY_ATTEMPTED: 'IN_TRANSIT',
  LOST: 'LOST',
  CANCELLED: 'DAMAGED',
  UNKNOWN: 'PREPARING',
}

interface ActorContext {
  source: TrackingEventSource
  userId?: string
}

async function logActivity(params: {
  invoiceId: string
  eventType: string
  previousValue?: string | null
  newValue?: string | null
  carrier?: ShippingCarrier | null
  trackingNumber?: string | null
  shipmentId?: string | null
  actor: ActorContext
}): Promise<void> {
  await prisma.invoiceActivityLog.create({
    data: {
      invoiceId: params.invoiceId,
      eventType: params.eventType,
      previousValue: params.previousValue ?? undefined,
      newValue: params.newValue ?? undefined,
      carrier: params.carrier ?? undefined,
      trackingNumber: params.trackingNumber ?? undefined,
      shipmentId: params.shipmentId ?? undefined,
      source: params.actor.source,
      userId: params.actor.userId ?? undefined,
    },
  })
}

// Fetches every shipment for the invoice and derives which one is primary —
// used by the admin single-shipment actions below (mark delivered, override
// status, remove tracking) so they keep acting on "the" shipment for an
// invoice exactly as they did before multi-shipment support existed. Once
// the UI lists individual shipments (see the Fulfillment Workflow plan's
// later stage), these actions can take a specific shipmentId instead.
async function getPrimaryShipmentForInvoice(invoiceId: string): Promise<Shipment | null> {
  const shipments = await prisma.shipment.findMany({ where: { invoiceId } })
  return getPrimaryShipment(shipments)
}

export interface RegisterShipmentInput {
  invoiceId: string
  carrier: ShippingCarrier
  service?: string
  trackingNumber: string
  trackingUrl: string
  providerName?: string
  providerTrackingId?: string
  origin: ShipmentOrigin
  // Populated only for LABEL_PURCHASE shipments — see lib/fulfillment/labels.ts.
  labelFields?: {
    shippoShipmentId?: string
    shippoTransactionId?: string
    postageAmount?: number
    shippingCost?: number
    labelUrl?: string
    labelPdfUrl?: string
    weightOz?: number
    lengthIn?: number
    widthIn?: number
    heightIn?: number
    purchasedAt: Date
    purchasedBy: string
  }
}

// Creates a brand-new Shipment row and denormalizes it onto the parent
// Invoice as the current primary (it always is, being the shipment that was
// just created — see lib/shipments/primary.ts). Shared by the manual
// "Add Tracking" flow below and the label-purchase flow (Fulfillment
// Workflow plan) — there is exactly one implementation of "register a
// shipment for webhook/polling monitoring."
export async function registerShipmentForMonitoring(input: RegisterShipmentInput): Promise<Shipment> {
  const shipment = await prisma.shipment.create({
    data: {
      invoiceId: input.invoiceId,
      carrier: input.carrier,
      service: input.service,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
      normalizedStatus: 'TRACKING_ADDED',
      monitoringActive: true,
      providerName: input.providerName,
      providerTrackingId: input.providerTrackingId,
      origin: input.origin,
      ...input.labelFields,
    },
  })

  await prisma.invoice.update({
    where: { id: input.invoiceId },
    data: {
      carrier: input.carrier,
      trackingNumber: input.trackingNumber,
      shippingService: input.service ?? undefined,
      trackingUrl: input.trackingUrl,
      shippingStatus: 'TRACKING_ADDED',
      deliveryStatus: LEGACY_DELIVERY_STATUS.TRACKING_ADDED,
      lastTrackingUpdate: new Date(),
    },
  })

  return shipment
}

export interface AddTrackingInput {
  carrier: ShippingCarrier
  trackingNumber: string
  service?: string
}

export interface AddTrackingResult {
  formatWarning?: string
  customerNotified: boolean
}

// Manual "Add Tracking" workflow: validate, register with the provider,
// generate a URL, and start monitoring — always as a brand-new Shipment row
// (an invoice can have several; nothing is ever overwritten or cleared).
// Still the right entry point for a hand-written label, PICKUP/HAND_DELIVERY,
// or any tracking number the admin already has from outside this app.
export async function addTrackingToInvoice(
  invoiceId: string,
  input: AddTrackingInput,
  actor: ActorContext
): Promise<AddTrackingResult> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { shipments: true } })
  const trackingNumber = input.trackingNumber.trim()
  if (!trackingNumber) throw new Error('Tracking number is required')

  const formatCheck = checkTrackingNumberFormat(input.carrier, trackingNumber)
  const existingPrimary = getPrimaryShipment(invoice.shipments)

  let providerTrackingId: string | undefined
  let trackingUrl = buildCarrierTrackingUrl(input.carrier, trackingNumber)
  const provider = getProviderForCarrier(input.carrier)
  if (provider) {
    const registered = await provider.registerTracking(input.carrier, trackingNumber)
    providerTrackingId = registered.providerTrackingId
    trackingUrl = registered.trackingUrl
  }

  const shipment = await registerShipmentForMonitoring({
    invoiceId,
    carrier: input.carrier,
    service: input.service,
    trackingNumber,
    trackingUrl,
    providerName: provider?.name,
    providerTrackingId,
    origin: 'MANUAL_ENTRY',
  })

  await logActivity({
    invoiceId,
    eventType: 'TRACKING_ADDED',
    previousValue: existingPrimary?.trackingNumber,
    newValue: trackingNumber,
    carrier: input.carrier,
    trackingNumber,
    shipmentId: shipment.id,
    actor,
  })

  const customerNotified = await sendShipmentNotificationIfNeeded({
    invoiceId,
    shipmentId: shipment.id,
    status: 'TRACKING_ADDED',
    latestMessage: 'Tracking number added',
  })

  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId,
      eventType: 'TRACKING_ADDED',
      previousValue: existingPrimary?.trackingNumber,
      newValue: trackingNumber,
      source: actor.source,
      userId: actor.userId,
    })
  }

  return { formatWarning: formatCheck.warning, customerNotified }
}

// Applies a batch of normalized events (from a webhook payload or a poll) to
// a shipment: dedups against existing rows, then — if anything genuinely
// new landed — recomputes the shipment's current status from whichever
// event is chronologically latest (not just last-in-array, since carrier
// events can arrive out of order) and cascades that into the invoice,
// activity log, completion rule, and a customer notification.
export async function processTrackingEvents(
  shipmentId: string,
  events: NormalizedTrackingEvent[],
  source: TrackingEventSource
): Promise<void> {
  if (events.length === 0) return

  let insertedAny = false
  for (const event of events) {
    const hash = computeEventHash(event)
    try {
      await prisma.trackingEvent.create({
        data: {
          shipmentId,
          providerEventId: event.providerEventId,
          normalizedStatus: event.normalizedStatus,
          carrierStatus: sanitizeCarrierText(event.carrierStatus),
          description: sanitizeCarrierText(event.description),
          location: event.location ? sanitizeCarrierText(event.location) : undefined,
          eventAt: event.eventAt,
          source,
          eventHash: hash,
        },
      })
      insertedAny = true
    } catch (err) {
      // P2002 = unique constraint violation on (shipmentId, eventHash) —
      // this exact event was already recorded (duplicate webhook/poll).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue
      throw err
    }
  }
  if (!insertedAny) return

  const latest = await prisma.trackingEvent.findFirst({
    where: { shipmentId },
    orderBy: { eventAt: 'desc' },
  })
  if (!latest) return

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { invoice: true } })
  if (shipment.normalizedStatus === latest.normalizedStatus && shipment.lastEventAt && shipment.lastEventAt >= latest.eventAt) {
    // Nothing actually changed about the current status (e.g. a re-delivered
    // duplicate that slipped past the hash check with different casing) —
    // still worth bumping lastCheckedAt, but no cascade needed.
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastCheckedAt: new Date() } })
    return
  }

  const previousStatus = shipment.normalizedStatus
  const isTerminal = TERMINAL_STATUSES.includes(latest.normalizedStatus)
  const isDelivered = latest.normalizedStatus === 'DELIVERED'
  const dateShipped =
    shipment.dateShipped ?? (latest.normalizedStatus !== 'NOT_SHIPPED' && latest.normalizedStatus !== 'TRACKING_ADDED' ? latest.eventAt : null)

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      normalizedStatus: latest.normalizedStatus,
      carrierStatus: latest.carrierStatus,
      lastEventAt: latest.eventAt,
      lastCheckedAt: new Date(),
      dateShipped: dateShipped ?? undefined,
      deliveredAt: isDelivered ? latest.eventAt : shipment.deliveredAt,
      monitoringActive: !isTerminal,
    },
  })

  const invoice = shipment.invoice

  // This shipment's own status just changed — but the invoice's
  // denormalized fields (Decision 2) should only move if this is still the
  // primary shipment. A status update landing late on a superseded/voided
  // shipment must not overwrite what the invoice shows for its current one.
  const allShipments = await prisma.shipment.findMany({ where: { invoiceId: invoice.id } })
  const primary = getPrimaryShipment(allShipments)
  const isPrimary = primary?.id === shipmentId

  if (isPrimary) {
    const newOrderStatus = computeOrderStatus(invoice.status, latest.normalizedStatus, invoice.orderStatus)
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        shippingStatus: latest.normalizedStatus,
        deliveryStatus: LEGACY_DELIVERY_STATUS[latest.normalizedStatus],
        lastTrackingUpdate: new Date(),
        deliveredDate: isDelivered ? latest.eventAt : invoice.deliveredDate,
        shipDate: dateShipped ?? invoice.shipDate,
        orderStatus: newOrderStatus,
      },
    })
  }

  await logActivity({
    invoiceId: invoice.id,
    eventType: 'SHIPPING_STATUS_UPDATED',
    previousValue: previousStatus,
    newValue: latest.normalizedStatus,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    shipmentId: shipment.id,
    actor: { source, userId: undefined },
  })

  await sendShipmentNotificationIfNeeded({
    invoiceId: invoice.id,
    shipmentId: shipment.id,
    status: latest.normalizedStatus,
    latestMessage: latest.carrierStatus ?? 'Status update',
  })

  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      eventType: isDelivered ? 'SHIPMENT_DELIVERED' : 'SHIPPING_STATUS_UPDATED',
      previousValue: previousStatus,
      newValue: latest.normalizedStatus,
      source,
    })
  }
}

// Admin "Refresh tracking manually" / polling-cron entry point: fetches the
// provider's current view of a shipment and feeds it through the same
// dedup/cascade path as a webhook.
export async function refreshShipmentTracking(shipmentId: string, source: TrackingEventSource): Promise<void> {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })
  const provider = getProviderForCarrier(shipment.carrier)
  if (!provider) return

  const result = await provider.getTrackingStatus(shipment.carrier, shipment.trackingNumber)
  if (result.estimatedDeliveryAt) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { estimatedDeliveryAt: result.estimatedDeliveryAt } })
  }
  await processTrackingEvents(shipmentId, result.events, source)
}

// Admin "Mark as delivered manually" override — recorded as a synthetic
// MANUAL event so it flows through the exact same cascade (invoice fields,
// activity log, completion rule, notification) as a real carrier event.
// Acts on the invoice's primary shipment (see getPrimaryShipmentForInvoice).
export async function markDeliveredManually(invoiceId: string, userId: string): Promise<void> {
  const shipment = await getPrimaryShipmentForInvoice(invoiceId)
  if (!shipment) throw new Error('No shipment to mark delivered')

  await processTrackingEvents(
    shipment.id,
    [{ normalizedStatus: 'DELIVERED', carrierStatus: 'Marked delivered by admin', description: 'Marked delivered by admin', eventAt: new Date() }],
    'MANUAL'
  )
  await logActivity({ invoiceId, eventType: 'MARKED_DELIVERED_MANUALLY', newValue: 'DELIVERED', shipmentId: shipment.id, actor: { source: 'MANUAL', userId } })
}

// Admin "Override an incorrect shipping status" control. Acts on the
// invoice's primary shipment (see getPrimaryShipmentForInvoice).
export async function overrideShippingStatus(invoiceId: string, status: ShippingStatus, userId: string): Promise<void> {
  const shipment = await getPrimaryShipmentForInvoice(invoiceId)
  if (!shipment) throw new Error('No shipment to override')

  await processTrackingEvents(
    shipment.id,
    [{ normalizedStatus: status, carrierStatus: 'Status manually overridden by admin', description: 'Status manually overridden by admin', eventAt: new Date() }],
    'MANUAL'
  )
  await logActivity({
    invoiceId,
    eventType: 'STATUS_OVERRIDDEN',
    previousValue: shipment.normalizedStatus,
    newValue: status,
    shipmentId: shipment.id,
    actor: { source: 'MANUAL', userId },
  })
}

// Admin "Remove an invalid tracking number" control. Shippo has no
// unregister endpoint, so this just stops monitoring — the Shipment row and
// its event history stay for the record, but polling/webhooks for it are
// ignored going forward (a subsequent Add Tracking call creates a fresh
// shipment anyway). Acts on the invoice's primary shipment.
export async function removeTracking(invoiceId: string, userId: string): Promise<void> {
  const shipment = await getPrimaryShipmentForInvoice(invoiceId)
  if (!shipment) return

  await prisma.shipment.update({ where: { id: shipment.id }, data: { monitoringActive: false } })
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { trackingNumber: null, trackingUrl: null, shippingStatus: 'NOT_SHIPPED', carrier: null },
  })
  await logActivity({
    invoiceId,
    eventType: 'TRACKING_REMOVED',
    previousValue: shipment.trackingNumber,
    carrier: shipment.carrier,
    shipmentId: shipment.id,
    actor: { source: 'MANUAL', userId },
  })
}

export { isTrackableCarrier }
