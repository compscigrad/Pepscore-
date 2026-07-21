// Centralized invoice math. The live preview, the PDF documents, and the
// server-side validation all import from here so a number can never drift
// between what the customer previews and what gets printed.
//
// Field naming follows Pepscore's own invoice convention (confirmed against
// the Marvin Alexander sample in the spec): "Subtotal" is itemsTotal +
// shipping, and "Total" is Subtotal minus discounts. This differs from
// typical accounting convention (where subtotal excludes shipping) but
// matches every number in the sample invoice exactly, so it's kept as-is
// rather than "corrected."

export interface InvoiceLineItemInput {
  quantity: number
  unitPrice: number
  lineDiscount?: number
}

export interface InvoiceDiscountInput {
  type: 'FIXED' | 'PERCENTAGE'
  amount: number
}

export interface InvoiceTotals {
  itemsTotal: number
  subtotal: number
  discountTotal: number
  total: number
  balanceDue: number
}

// Quantity × unit price, less any line-level discount. Never negative.
export function lineItemTotal(item: InvoiceLineItemInput): number {
  const raw = item.quantity * item.unitPrice - (item.lineDiscount ?? 0)
  return Math.max(0, round2(raw))
}

export function itemsTotal(items: InvoiceLineItemInput[]): number {
  return round2(items.reduce((sum, item) => sum + lineItemTotal(item), 0))
}

// Resolves a single discount to a dollar amount. Percentage discounts are
// computed against the pre-shipping items total (not the shipping-inclusive
// subtotal), so a "10% off" promo never discounts the customer's shipping cost.
export function resolveDiscountAmount(discount: InvoiceDiscountInput, itemsTotalValue: number): number {
  if (discount.type === 'PERCENTAGE') {
    return round2(itemsTotalValue * (discount.amount / 100))
  }
  return round2(discount.amount)
}

// Discounts stack additively against the items total — each promotion is
// independent, not compounded on top of the others' already-discounted price.
export function discountTotal(discounts: InvoiceDiscountInput[], itemsTotalValue: number): number {
  return round2(discounts.reduce((sum, d) => sum + resolveDiscountAmount(d, itemsTotalValue), 0))
}

export function calculateInvoiceTotals(
  items: InvoiceLineItemInput[],
  discounts: InvoiceDiscountInput[],
  shippingCost: number,
  amountPaid: number
): InvoiceTotals {
  const itemsTotalValue = itemsTotal(items)
  const subtotal = round2(itemsTotalValue + shippingCost)
  const discountTotalValue = discountTotal(discounts, itemsTotalValue)
  const total = Math.max(0, round2(subtotal - discountTotalValue))
  const balanceDue = round2(total - amountPaid)

  return {
    itemsTotal: itemsTotalValue,
    subtotal,
    discountTotal: discountTotalValue,
    total,
    balanceDue,
  }
}

// Guards against floating-point currency drift (e.g. 0.1 + 0.2) accumulating
// across many line items and discounts.
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
