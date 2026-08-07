// Client-side draft shapes for the invoice builder. Line items and discounts
// carry a `key` (client-generated, stable across re-renders) separate from
// `id`/`productId`/`promotionId` — a brand-new row has no server id yet, but
// still needs a stable React key for reordering/deleting to work correctly.
import type { Product, Promotion, InvoiceStatus, ShippingCarrier, DeliveryStatus, PromotionType, InvoiceItemSellUnit, InvoiceItemPriceTier } from '@prisma/client'

export interface AddressDraft {
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
}

export interface CustomerFields {
  customerName: string
  customerCompany: string
  customerEmail: string
  customerPhone: string
  billingAddress: AddressDraft
  internalNotes: string
  publicNotes: string
}

export interface ShippingFields {
  shippingAddress: AddressDraft
  carrier: ShippingCarrier | ''
  trackingNumber: string
  shippingCost: number
  shipDate: string
  deliveryDate: string
  deliveredDate: string
  deliveryStatus: DeliveryStatus
}

export interface InvoiceItemDraft {
  key: string
  // The real database row id, when this draft was loaded from an existing
  // invoice -- null for a row the admin just added in this editing session.
  // Round-tripped through save so the server can update the existing row in
  // place instead of deleting and recreating it (see updateInvoice()) --
  // required so anything that references a specific InvoiceItem row (e.g. a
  // BackorderCondition) survives an unrelated edit to the same invoice.
  id: string | null
  productId: string | null
  name: string
  description: string
  quantity: number
  unitPrice: number
  lineDiscount: number
  // Inventory & Pricing MVP -- undefined/null for a free-typed line item or
  // a catalog product with no configured sell units (still the vast
  // majority of the catalog); only set when the admin picked a real case/
  // SPA/bulk/individual-vial option for a product that has one.
  sellUnit?: InvoiceItemSellUnit | null
  unitsPerSellUnit?: number | null
  priceTier?: InvoiceItemPriceTier | null
  skuSnapshot?: string | null
  inventoryQuantityConsumed?: number | null
}

export interface InvoiceDiscountDraft {
  key: string
  // Same id round-tripping as InvoiceItemDraft, and for the same reason --
  // a BackorderCompensation's discount must survive unrelated invoice edits.
  id: string | null
  promotionId: string | null
  label: string
  type: PromotionType
  amount: number
}

export interface InvoiceDraft {
  orderId: string | null
  customer: CustomerFields
  shipping: ShippingFields
  items: InvoiceItemDraft[]
  discounts: InvoiceDiscountDraft[]
  status: InvoiceStatus
}

export const EMPTY_ADDRESS: AddressDraft = { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' }

export const EMPTY_DRAFT: InvoiceDraft = {
  orderId: null,
  customer: {
    customerName: '',
    customerCompany: '',
    customerEmail: '',
    customerPhone: '',
    billingAddress: EMPTY_ADDRESS,
    internalNotes: '',
    publicNotes: '',
  },
  shipping: {
    shippingAddress: EMPTY_ADDRESS,
    carrier: '',
    trackingNumber: '',
    shippingCost: 0,
    shipDate: '',
    deliveryDate: '',
    deliveredDate: '',
    deliveryStatus: 'PREPARING',
  },
  items: [],
  discounts: [],
  status: 'DRAFT',
}

export function makeKey(): string {
  return Math.random().toString(36).slice(2)
}

// Every status the admin can manually select. PAID/PARTIALLY_PAID are
// deliberately NOT here — they live on InvoicePaymentStatus now, derived
// exclusively from confirmed InvoicePayment records (lib/invoice/status.ts).
// A payment made outside the system (e.g. a wire confirmed by phone) must
// still go through Record Payment, never a status dropdown — that was the
// exact hole that let an invoice read "Paid" with zero payment records
// behind it (see docs/Decisions.md). PENDING is also excluded — it's the
// automatic overlay for "issued with a positive balance," never manual.
export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'CANCELLED', 'REFUNDED', 'VOID']

export function formatStatusLabel(status: InvoiceStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export type { Product, Promotion }
