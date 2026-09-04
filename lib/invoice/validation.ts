// zod schemas for invoice create/update payloads. Validated server-side in
// the API routes — the live preview intentionally stays permissive (it must
// render invoices that are still mid-edit) so all hard validation lives here.
import { z } from 'zod'

export const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be 5 digits (or ZIP+4)'),
  country: z.string().min(1).default('US'),
})

// `id` is present (and matched against existing rows) when editing a row
// that already exists in the database, absent/null for a genuinely new row
// -- see updateInvoice()'s upsert-by-id handling. Never trust it blindly:
// the server only honors an id that actually belongs to this invoice.
const lineItemSchema = z
  .object({
    id: z.string().optional().nullable(),
    productId: z.string().optional().nullable(),
    name: z.string().min(1, 'Product name is required'),
    description: z.string().optional(),
    quantity: z.number().int().positive('Quantity must be at least 1'),
    unitPrice: z.number().nonnegative('Price cannot be negative'),
    lineDiscount: z.number().nonnegative().default(0),
    sortOrder: z.number().int().default(0),
    // Inventory & Pricing MVP -- all optional so a free-typed line item (no
    // catalog product, or a catalog product with no configured sell units)
    // stays exactly as valid as it was before this sprint.
    sellUnit: z.enum(['CASE_STANDARD', 'CASE_PRO', 'CASE_BULK', 'INDIVIDUAL_VIAL']).optional().nullable(),
    unitsPerSellUnit: z.number().int().positive().optional().nullable(),
    priceTier: z.enum(['STANDARD', 'PRO', 'BULK', 'INDIVIDUAL', 'MANUAL']).optional().nullable(),
    skuSnapshot: z.string().optional().nullable(),
    manualPricingOverride: z.boolean().optional(),
    inventoryQuantityConsumed: z.number().int().nonnegative().optional().nullable(),
    // Finance COGS-coverage fix (2026-08-19) -- total (quantity-extended)
    // cost of goods for this line. Nullable/optional so a free-typed line
    // item or a product with no recorded cost stays exactly as valid as
    // before this field existed.
    costOfGoods: z.number().nonnegative().optional().nullable(),
  })
  // A line-item discount is a courtesy adjustment, never a path to a
  // negative/credit line -- lineItemTotal() already clamps to $0, but
  // rejecting an over-discount here catches a fat-fingered amount (e.g. an
  // extra zero) before it silently zeroes out a line's real price.
  .refine((item) => (item.lineDiscount ?? 0) <= item.quantity * item.unitPrice, {
    message: 'Line discount cannot exceed the line’s own price (quantity × unit price)',
    path: ['lineDiscount'],
  })

const discountSchema = z
  .object({
    id: z.string().optional().nullable(),
    promotionId: z.string().optional().nullable(),
    // A custom (non-preset) discount is valid with no label typed -- the
    // owner shouldn't have to name a one-off courtesy adjustment just to save
    // the invoice. Blank/whitespace-only falls back to "Miscellaneous", which
    // is what actually gets stored on the InvoiceDiscount row (not just
    // displayed), so every later reader (PDF, portal, Finance) sees a real
    // label without having to special-case an empty string itself.
    label: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() !== '' ? v.trim() : 'Miscellaneous')),
    type: z.enum(['FIXED', 'PERCENTAGE']),
    amount: z.number().nonnegative('Discount amount cannot be negative'),
  })
  .refine((d) => d.type !== 'PERCENTAGE' || d.amount <= 100, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['amount'],
  })

export const invoicePayloadSchema = z.object({
  orderId: z.string().optional().nullable(),
  // Only ever sent by the create-mode "New Invoice from profile" flow — an
  // update payload that omits it leaves an existing invoice's link
  // untouched (see updateInvoice's `?? undefined` handling).
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerCompany: z.string().optional(),
  customerEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  internalNotes: z.string().optional(),
  publicNotes: z.string().optional(),

  carrier: z
    .enum(['USPS', 'UPS', 'FEDEX', 'DHL', 'PICKUP', 'HAND_DELIVERY', 'COURIER', 'OTHER'])
    .optional()
    .nullable(),
  trackingNumber: z.string().optional(),
  shippingCost: z.number().nonnegative('Shipping cost cannot be negative').default(0),
  shipDate: z.coerce.date().optional().nullable(),
  deliveryDate: z.coerce.date().optional().nullable(),
  deliveredDate: z.coerce.date().optional().nullable(),
  deliveryStatus: z
    .enum(['PREPARING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'LOST', 'DAMAGED'])
    .default('PREPARING'),

  items: z.array(lineItemSchema).min(1, 'At least one product is required'),
  discounts: z.array(discountSchema).default([]),

  // PENDING is deliberately excluded here — it's never admin-settable, only
  // the automatic overlay applied whenever an issued invoice still has a
  // positive balance (see lib/invoice/status.ts's deriveInvoiceWorkflowStatus
  // and docs/Decisions.md's payment-status overhaul). PAID/PARTIALLY_PAID/
  // APPROVED were removed entirely from InvoiceStatus — see the same note.
  status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED', 'REFUNDED', 'VOID']).default('DRAFT'),
})

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>

// NA is deliberately excluded here — it's the Method dropdown's placeholder
// default for an invoice with no payment recorded yet, not a legal value for
// an actual payment (money always changes hands via some real method).
const REAL_PAYMENT_METHODS = [
  'CASH', 'COD', 'CREDIT_CARD', 'DEBIT_CARD', 'APPLE_PAY', 'PAYPAL', 'BANK_TRANSFER',
  'STRIPE', 'SQUARE', 'CASH_APP', 'VENMO', 'ZELLE', 'ACH', 'WIRE', 'CHECK', 'CRYPTO', 'OTHER',
] as const

export const paymentPayloadSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.enum(REAL_PAYMENT_METHODS),
  referenceNumber: z.string().optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  // Only meaningful when method is 'STRIPE' -- the real Stripe
  // PaymentIntent id for a charge that happened outside this app (e.g. a
  // Payment Link or the Stripe Dashboard), letting recordPayment() look up
  // the real processing fee rather than assuming one. Ignored for every
  // other payment method.
  stripePaymentIntentId: z.string().trim().min(1).optional(),
})

export type PaymentPayload = z.infer<typeof paymentPayloadSchema>

// Unlike paymentPayloadSchema, this isn't recording a new transaction (no
// method field, because no money changes hands here). `startDate` is only
// required when the invoice has no payment recorded yet — with a prior
// payment, "Initial Payment Amount/Date" and "Remaining Balance" are all
// derived server-side from the invoice's existing history in
// lib/paymentArrangements.ts, so they can never disagree with the invoice's
// actual amountPaid/balanceDue.
export const paymentArrangementPayloadSchema = z.object({
  numberOfPayments: z.number().int().min(1, 'At least one payment is required'),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY']),
  startDate: z.coerce.date().optional(),
})

export type PaymentArrangementPayload = z.infer<typeof paymentArrangementPayloadSchema>

// Section 10/11 — the client's Pay in Full selection (a stated intention,
// never a payment record). NA excluded for the same reason as above.
export const payInFullSelectionSchema = z.object({
  method: z.enum(REAL_PAYMENT_METHODS),
})

export type PayInFullSelectionPayload = z.infer<typeof payInFullSelectionSchema>

// Section 13/15 — the client's payment-arrangement request. Frequency is
// client-chosen; the installment count/schedule is always the Section 14
// system recommendation (lib/invoice/status.ts's recommendInstallmentCount),
// never client-supplied, so there's no numberOfPayments field here.
export const arrangementRequestSchema = z.object({
  frequency: z.enum(['WEEKLY', 'BIWEEKLY']),
  proposedDownPayment: z.number().nonnegative('Down payment cannot be negative').default(0),
})

export type ArrangementRequestPayload = z.infer<typeof arrangementRequestSchema>

// Guards a payment against overpaying an invoice — checked against the
// invoice's *current* balance, so partial payments accumulate correctly.
export function assertPaymentWithinBalance(paymentAmount: number, currentBalanceDue: number) {
  if (paymentAmount > currentBalanceDue + 0.005) {
    throw new Error(
      `Payment of $${paymentAmount.toFixed(2)} exceeds the remaining balance of $${currentBalanceDue.toFixed(2)}`
    )
  }
}
