// Real Shippo rate-shopping + label purchase for invoices — the piece that
// actually creates a shipment (buys postage), as opposed to lib/tracking/
// which only monitors one once it exists. Reuses lib/shippo.ts's existing
// Order-side Shippo client, the Fulfillment Gate (./gate.ts), and
// lib/tracking/service.ts's shared "register a shipment for monitoring"
// helper — there is exactly one implementation of each of those concerns.
import type { ShippingCarrier, Shipment } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRates, purchaseLabel, type AddressInput, type ParcelInput, type ShippoRate } from '@/lib/shippo'
import { checkFulfillmentEligibility } from './gate'
import { getFulfillmentSettings } from './settings'
import { registerShipmentForMonitoring } from '@/lib/tracking/service'
import { buildCarrierTrackingUrl } from '@/lib/tracking/carrierUrls'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'

export interface PackageWeight {
  value: number
  unit: 'oz' | 'lb'
}

export interface PackageDimensions {
  lengthIn: number
  widthIn: number
  heightIn: number
}

function weightToOz(weight: PackageWeight): number {
  return weight.unit === 'lb' ? weight.value * 16 : weight.value
}

// Per the spec's explicit "display the actual Shippo error" requirement for
// this money-spending flow — a deliberate contrast with the tracking-
// registration path's sanitizedShippoError, which hides raw errors from
// admins for a read-only status check. Here the admin needs exact detail
// (bad address, insufficient balance, etc.) to fix and retry. The message
// is always a plain string built from Shippo's own error response — never a
// raw object/header dump — so nothing account-sensitive leaks either way.
export class FulfillmentLabelError extends Error {}

interface InvoiceShippingAddress {
  street1?: string
  street2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
}

export async function getShippingRatesForInvoice(
  invoiceId: string,
  weight: PackageWeight,
  dimensions: PackageDimensions
): Promise<ShippoRate[]> {
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
    getFulfillmentSettings(),
  ])

  if (!settings.returnAddress) {
    throw new FulfillmentLabelError('Configure a return address under Settings → Fulfillment before requesting rates.')
  }
  const shippingAddress = invoice.shippingAddress as InvoiceShippingAddress | null
  if (!shippingAddress?.street1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
    throw new FulfillmentLabelError('This invoice has no complete shipping address on file.')
  }

  const addressFrom: AddressInput = settings.returnAddress
  const addressTo: AddressInput = {
    name: invoice.customerName,
    street1: shippingAddress.street1,
    street2: shippingAddress.street2 || undefined,
    city: shippingAddress.city,
    state: shippingAddress.state,
    zip: shippingAddress.zip,
    country: shippingAddress.country || 'US',
    phone: invoice.customerPhone || undefined,
    email: invoice.customerEmail || undefined,
  }
  const parcel: ParcelInput = {
    length: String(dimensions.lengthIn),
    width: String(dimensions.widthIn),
    height: String(dimensions.heightIn),
    distance_unit: 'in',
    weight: String(weightToOz(weight)),
    mass_unit: 'oz',
  }

  try {
    return await getRates(addressFrom, addressTo, parcel)
  } catch (err) {
    console.error('[fulfillment/labels] getRates failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new FulfillmentLabelError(`Could not fetch shipping rates: ${message}`)
  }
}

export interface PurchaseShippingLabelInput {
  rateObjectId: string
  carrier: ShippingCarrier
  service: string
  weight: PackageWeight
  dimensions?: PackageDimensions
}

// Fulfillment Gate is checked here too, not just in the UI — never trust a
// client-side check alone (Decision 6 of the Fulfillment Workflow plan).
export async function purchaseShippingLabelForInvoice(
  invoiceId: string,
  input: PurchaseShippingLabelInput,
  actor: { userId: string }
): Promise<Shipment> {
  const eligibility = await checkFulfillmentEligibility(invoiceId)
  if (!eligibility.allowed) {
    throw new FulfillmentLabelError(
      'This invoice is not yet eligible for fulfillment — it must be paid in full, have an active payment arrangement, or a manual override on record.'
    )
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  if (invoice.deletedAt) throw new FulfillmentLabelError('This invoice is in the trash.')
  if (invoice.archivedAt) throw new FulfillmentLabelError('This invoice is archived.')
  if (invoice.status === 'CANCELLED' || invoice.status === 'VOID' || invoice.status === 'REFUNDED') {
    throw new FulfillmentLabelError('Cannot create a shipping label for a cancelled, voided, or refunded invoice.')
  }

  // Nothing is written to the database until Shippo confirms success — a
  // failed purchase never leaves a partial Shipment record, and the
  // admin's entered form values are untouched for a retry (Decision 12).
  let purchased
  try {
    purchased = await purchaseLabel(input.rateObjectId, 'PDF_4x6')
  } catch (err) {
    console.error('[fulfillment/labels] purchaseLabel failed:', err)
    // lib/shippo.ts's own error already reads as "Shippo label purchase
    // failed: <detail>" — pass it through as-is rather than re-wrapping it.
    throw new FulfillmentLabelError(err instanceof Error ? err.message : 'Shippo label purchase failed: unknown error')
  }

  const trackingUrl = buildCarrierTrackingUrl(input.carrier, purchased.tracking_number)
  const postageAmount = parseFloat(purchased.rate.amount)

  const shipment = await registerShipmentForMonitoring({
    invoiceId,
    carrier: input.carrier,
    service: input.service,
    trackingNumber: purchased.tracking_number,
    trackingUrl,
    providerName: 'shippo',
    providerTrackingId: purchased.object_id,
    origin: 'LABEL_PURCHASE',
    labelFields: {
      shippoTransactionId: purchased.object_id,
      postageAmount,
      shippingCost: postageAmount,
      labelUrl: purchased.label_url,
      labelPdfUrl: purchased.label_url,
      weightOz: weightToOz(input.weight),
      lengthIn: input.dimensions?.lengthIn,
      widthIn: input.dimensions?.widthIn,
      heightIn: input.dimensions?.heightIn,
      purchasedAt: new Date(),
      purchasedBy: actor.userId,
    },
  })

  await prisma.invoiceActivityLog.create({
    data: {
      invoiceId,
      eventType: 'LABEL_PURCHASED',
      newValue: purchased.tracking_number,
      carrier: input.carrier,
      trackingNumber: purchased.tracking_number,
      shipmentId: shipment.id,
      source: 'MANUAL',
      userId: actor.userId,
    },
  })

  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId,
      eventType: 'LABEL_PURCHASED',
      newValue: purchased.tracking_number,
      source: 'MANUAL',
      userId: actor.userId,
    })
  }

  return shipment
}

// Shippo's refund/void API isn't wired up here (no precedent for it in the
// existing Order-side lib/shippo.ts either) — this marks the record so it's
// visibly no longer the active shipment and stops being monitored; actually
// refunding the postage, if eligible, still needs the Shippo dashboard for
// now. Never deletes the row — the purchase stays in the permanent record.
export async function voidShipment(shipmentId: string, userId: string): Promise<void> {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } })
  if (shipment.voidedAt) return

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { voidedAt: new Date(), voidedBy: userId, monitoringActive: false },
  })

  await prisma.invoiceActivityLog.create({
    data: {
      invoiceId: shipment.invoiceId,
      eventType: 'SHIPMENT_VOIDED',
      shipmentId: shipment.id,
      source: 'MANUAL',
      userId,
    },
  })
}
