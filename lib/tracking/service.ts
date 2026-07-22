// Core tracking service — the only module that mutates Shipment/TrackingEvent/
// InvoiceActivityLog rows or talks to a ShippingProvider. Invoice routes and
// UI call these functions; nothing else touches lib/tracking's internals or
// Prisma tables directly.
import { Prisma } from '@prisma/client'
import type { ShippingCarrier, ShippingStatus, TrackingEventSource, DeliveryStatus } from '@prisma/client'
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
      source: params.actor.source,
      userId: params.actor.userId ?? undefined,
    },
  })
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

// Steps 1-9 of the spec's "Tracking Number Workflow": validate, save,
// register with the provider, generate a URL, set the initial status, log
// activity, begin monitoring (monitoringActive defaults true), and notify
// the customer. A previously-tracked invoice replacing its tracking number
// is treated as a fresh registration — the old Shipment row is reused
// in-place (never a second row per invoice; the unique invoiceId constraint
// on Shipment already prevents that), its event history is cleared since
// it belongs to a different physical package.
export async function addTrackingToInvoice(
  invoiceId: string,
  input: AddTrackingInput,
  actor: ActorContext
): Promise<AddTrackingResult> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { shipment: true } })
  const trackingNumber = input.trackingNumber.trim()
  if (!trackingNumber) throw new Error('Tracking number is required')

  const formatCheck = checkTrackingNumberFormat(input.carrier, trackingNumber)
  const isReplacement = !!invoice.shipment && invoice.shipment.trackingNumber !== trackingNumber

  let providerTrackingId: string | undefined
  let trackingUrl = buildCarrierTrackingUrl(input.carrier, trackingNumber)
  const provider = getProviderForCarrier(input.carrier)
  if (provider) {
    const registered = await provider.registerTracking(input.carrier, trackingNumber)
    providerTrackingId = registered.providerTrackingId
    trackingUrl = registered.trackingUrl
  }

  if (invoice.shipment && isReplacement) {
    // A new physical package — old event history no longer applies.
    await prisma.trackingEvent.deleteMany({ where: { shipmentId: invoice.shipment.id } })
  }

  await prisma.shipment.upsert({
    where: { invoiceId },
    update: {
      carrier: input.carrier,
      service: input.service ?? undefined,
      trackingNumber,
      trackingUrl,
      normalizedStatus: 'TRACKING_ADDED',
      carrierStatus: null,
      lastCheckedAt: new Date(),
      lastEventAt: null,
      monitoringActive: true,
      providerName: provider?.name,
      providerTrackingId,
      deliveredAt: null,
    },
    create: {
      invoiceId,
      carrier: input.carrier,
      service: input.service,
      trackingNumber,
      trackingUrl,
      normalizedStatus: 'TRACKING_ADDED',
      monitoringActive: true,
      providerName: provider?.name,
      providerTrackingId,
    },
  })

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      carrier: input.carrier,
      trackingNumber,
      shippingService: input.service ?? undefined,
      trackingUrl,
      shippingStatus: 'TRACKING_ADDED',
      deliveryStatus: LEGACY_DELIVERY_STATUS.TRACKING_ADDED,
      lastTrackingUpdate: new Date(),
    },
  })

  await logActivity({
    invoiceId,
    eventType: isReplacement ? 'TRACKING_NUMBER_REPLACED' : 'TRACKING_ADDED',
    previousValue: invoice.shipment?.trackingNumber,
    newValue: trackingNumber,
    carrier: input.carrier,
    trackingNumber,
    actor,
  })

  const customerNotified = await sendShipmentNotificationIfNeeded({
    invoiceId,
    status: 'TRACKING_ADDED',
    latestMessage: 'Tracking number added',
  })

  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId,
      eventType: isReplacement ? 'TRACKING_NUMBER_REPLACED' : 'TRACKING_ADDED',
      previousValue: invoice.shipment?.trackingNumber,
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

  await logActivity({
    invoiceId: invoice.id,
    eventType: 'SHIPPING_STATUS_UPDATED',
    previousValue: previousStatus,
    newValue: latest.normalizedStatus,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    actor: { source, userId: undefined },
  })

  await sendShipmentNotificationIfNeeded({
    invoiceId: invoice.id,
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
export async function markDeliveredManually(invoiceId: string, userId: string): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { invoiceId } })
  if (!shipment) throw new Error('No shipment to mark delivered')

  await processTrackingEvents(
    shipment.id,
    [{ normalizedStatus: 'DELIVERED', carrierStatus: 'Marked delivered by admin', description: 'Marked delivered by admin', eventAt: new Date() }],
    'MANUAL'
  )
  await logActivity({ invoiceId, eventType: 'MARKED_DELIVERED_MANUALLY', newValue: 'DELIVERED', actor: { source: 'MANUAL', userId } })
}

// Admin "Override an incorrect shipping status" control.
export async function overrideShippingStatus(invoiceId: string, status: ShippingStatus, userId: string): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { invoiceId } })
  if (!shipment) throw new Error('No shipment to override')

  await processTrackingEvents(
    shipment.id,
    [{ normalizedStatus: status, carrierStatus: 'Status manually overridden by admin', description: 'Status manually overridden by admin', eventAt: new Date() }],
    'MANUAL'
  )
  await logActivity({ invoiceId, eventType: 'STATUS_OVERRIDDEN', previousValue: shipment.normalizedStatus, newValue: status, actor: { source: 'MANUAL', userId } })
}

// Admin "Remove an invalid tracking number" control. Shippo has no
// unregister endpoint, so this just stops monitoring — the Shipment row and
// its event history stay for the record, but polling/webhooks for it are
// ignored going forward (a subsequent Add Tracking call replaces it anyway).
export async function removeTracking(invoiceId: string, userId: string): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { invoiceId } })
  if (!shipment) return

  await prisma.shipment.update({ where: { invoiceId }, data: { monitoringActive: false } })
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { trackingNumber: null, trackingUrl: null, shippingStatus: 'NOT_SHIPPED', carrier: null },
  })
  await logActivity({
    invoiceId,
    eventType: 'TRACKING_REMOVED',
    previousValue: shipment.trackingNumber,
    carrier: shipment.carrier,
    actor: { source: 'MANUAL', userId },
  })
}

export { isTrackableCarrier }
