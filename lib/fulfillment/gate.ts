// The Fulfillment Gate — one centralized "is this invoice allowed to ship"
// check, called both by the UI (enable/disable the purchase button) and
// again inside the label-purchase service itself (never trust the client).
// No duplicated eligibility logic anywhere else in the app.
import { prisma } from '@/lib/prisma'
import { hasActivePaymentArrangement } from '@/lib/paymentArrangements'
import { syncCustomerFromInvoiceEvent } from '@/lib/customers'

export type FulfillmentEligibilityReason = 'PAID_IN_FULL' | 'ACTIVE_PAYMENT_ARRANGEMENT' | 'MANUAL_OVERRIDE'

export interface FulfillmentEligibility {
  allowed: boolean
  reason?: FulfillmentEligibilityReason
}

// Pure decision logic — tested directly, no database involved.
export function computeFulfillmentEligibility(input: {
  balanceDue: number
  hasActivePaymentArrangement: boolean
  fulfillmentOverrideAt: Date | null
}): FulfillmentEligibility {
  if (input.fulfillmentOverrideAt) return { allowed: true, reason: 'MANUAL_OVERRIDE' }
  if (input.balanceDue <= 0) return { allowed: true, reason: 'PAID_IN_FULL' }
  if (input.hasActivePaymentArrangement) return { allowed: true, reason: 'ACTIVE_PAYMENT_ARRANGEMENT' }
  return { allowed: false }
}

export async function checkFulfillmentEligibility(invoiceId: string): Promise<FulfillmentEligibility> {
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })
  const activeArrangement = await hasActivePaymentArrangement(invoiceId)

  return computeFulfillmentEligibility({
    balanceDue: invoice.balanceDue,
    hasActivePaymentArrangement: activeArrangement,
    fulfillmentOverrideAt: invoice.fulfillmentOverrideAt,
  })
}

// Admin "Fulfill anyway" action — a permanent, attributed record (who, when,
// why), never a plain boolean. Writes both the invoice and customer
// timelines so "this shipped before normal payment requirements" is
// discoverable forever.
export async function overrideFulfillmentEligibility(invoiceId: string, userId: string, note?: string): Promise<void> {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      fulfillmentOverrideAt: new Date(),
      fulfillmentOverrideBy: userId,
      fulfillmentOverrideNote: note || undefined,
    },
  })

  await prisma.invoiceActivityLog.create({
    data: {
      invoiceId,
      eventType: 'FULFILLMENT_OVERRIDE',
      newValue: note || undefined,
      source: 'MANUAL',
      userId,
    },
  })

  if (invoice.customerId) {
    await syncCustomerFromInvoiceEvent({
      customerId: invoice.customerId,
      invoiceId,
      eventType: 'FULFILLMENT_OVERRIDE',
      newValue: note || undefined,
      source: 'MANUAL',
      userId,
    })
  }
}
