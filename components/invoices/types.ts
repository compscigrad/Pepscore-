// Client-side draft shapes for the invoice builder. Line items and discounts
// carry a `key` (client-generated, stable across re-renders) separate from
// `id`/`productId`/`promotionId` — a brand-new row has no server id yet, but
// still needs a stable React key for reordering/deleting to work correctly.
import type { Product, Promotion, InvoiceStatus, ShippingCarrier, DeliveryStatus, PromotionType } from '@prisma/client'

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
  productId: string | null
  name: string
  description: string
  quantity: number
  unitPrice: number
  lineDiscount: number
}

export interface InvoiceDiscountDraft {
  key: string
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

export type { Product, Promotion }
