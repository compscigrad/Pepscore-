// zod schemas for invoice create/update payloads. Validated server-side in
// the API routes — the live preview intentionally stays permissive (it must
// render invoices that are still mid-edit) so all hard validation lives here.
import { z } from 'zod'

const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be 5 digits (or ZIP+4)'),
  country: z.string().min(1).default('US'),
})

const lineItemSchema = z.object({
  productId: z.string().optional().nullable(),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.number().nonnegative('Price cannot be negative'),
  lineDiscount: z.number().nonnegative().default(0),
  sortOrder: z.number().int().default(0),
})

const discountSchema = z.object({
  promotionId: z.string().optional().nullable(),
  label: z.string().min(1, 'Discount label is required'),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  amount: z.number().nonnegative('Discount amount cannot be negative'),
})

export const invoicePayloadSchema = z.object({
  orderId: z.string().optional().nullable(),
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

  status: z
    .enum(['DRAFT', 'PENDING', 'APPROVED', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED', 'VOID'])
    .default('DRAFT'),
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
})

export type PaymentPayload = z.infer<typeof paymentPayloadSchema>

// Deliberately just these two fields — unlike paymentPayloadSchema, this
// isn't recording a new transaction (no method field, because no money
// changes hands here). "Initial Payment Amount/Date" and "Remaining
// Balance" are derived server-side from the invoice's existing payment
// history in lib/paymentArrangements.ts, not client-supplied, so they can
// never disagree with the invoice's actual amountPaid/balanceDue.
export const paymentArrangementPayloadSchema = z.object({
  remainingPayments: z.number().int().min(1, 'At least one remaining payment is required'),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY']),
})

export type PaymentArrangementPayload = z.infer<typeof paymentArrangementPayloadSchema>

// Guards a payment against overpaying an invoice — checked against the
// invoice's *current* balance, so partial payments accumulate correctly.
export function assertPaymentWithinBalance(paymentAmount: number, currentBalanceDue: number) {
  if (paymentAmount > currentBalanceDue + 0.005) {
    throw new Error(
      `Payment of $${paymentAmount.toFixed(2)} exceeds the remaining balance of $${currentBalanceDue.toFixed(2)}`
    )
  }
}
