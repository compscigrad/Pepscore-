// Pure refund math for item-level refunds (2026-08-14 sprint) — no I/O
// here, matching this codebase's established split (lib/invoice/
// calculations.ts, lib/invoice/backorder.ts) between pure, unit-tested
// business logic and the transactional lib/refunds.ts wrapper that
// actually reads/writes Prisma. Deliberately reuses calculations.ts's
// own itemsTotal/lineItemTotal definitions rather than recomputing gross
// item value a second way.
//
// Allocation rule (owner spec): an invoice-level discount is spread
// across merchandise lines in proportion to each line's own share of
// itemsTotal -- never divided evenly across line COUNT except in the
// case where that happens to be mathematically identical (equal-value
// lines). Shipping and tax are never allocated into this -- shipping is
// invoice-level and separate (Invoice.shippingCost), and Invoice/
// InvoiceItem has no tax field in this schema at all today.
// Small local duplicate of lib/invoice/calculations.ts's own private
// helper of the same name/shape — matches how formatMoney()/this exact
// pattern is already duplicated per-file elsewhere in this codebase
// rather than exported and shared.
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface RefundableItem {
  id: string
  /** InvoiceItem.total -- gross line value, already nets lineDiscount. */
  total: number
  quantity: number
}

export interface ItemAllocation {
  itemId: string
  grossValue: number
  allocatedDiscount: number
  effectivePaidValue: number
}

// Proportional allocation with penny-accurate reconciliation: naive
// per-item rounding can leave the allocated amounts summing to a cent or
// two off the real discount total, so any leftover after rounding is
// assigned to the last item (stable id order) rather than silently lost
// or double-counted. The discount total is first capped at the
// merchandise total itself so no single item's allocation can ever
// exceed what that item is actually worth (a discount larger than
// itemsTotal is already an unusual invoice state; this keeps allocation
// well-defined rather than producing a negative effectivePaidValue).
export function allocateInvoiceDiscount(items: RefundableItem[], invoiceDiscountTotal: number): ItemAllocation[] {
  const itemsTotalValue = round2(items.reduce((sum, i) => sum + i.total, 0))
  const cappedDiscount = Math.max(0, Math.min(round2(invoiceDiscountTotal), itemsTotalValue))

  if (items.length === 0) return []

  if (itemsTotalValue <= 0 || cappedDiscount <= 0) {
    return items.map((item) => ({
      itemId: item.id,
      grossValue: item.total,
      allocatedDiscount: 0,
      effectivePaidValue: item.total,
    }))
  }

  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id))
  const allocations = sorted.map((item) => round2(cappedDiscount * (item.total / itemsTotalValue)))
  const allocatedSum = round2(allocations.reduce((s, a) => s + a, 0))
  const remainder = round2(cappedDiscount - allocatedSum)
  if (remainder !== 0 && allocations.length > 0) {
    allocations[allocations.length - 1] = round2(allocations[allocations.length - 1] + remainder)
  }

  return sorted.map((item, i) => {
    const allocatedDiscount = Math.min(allocations[i], item.total)
    return {
      itemId: item.id,
      grossValue: item.total,
      allocatedDiscount,
      effectivePaidValue: round2(item.total - allocatedDiscount),
    }
  })
}

// The refundable ceiling for one line: its effective paid value, less
// whatever has already been requested/completed against it (PENDING,
// AWAITING_MANUAL_PROCESSING, PROCESSING, and COMPLETED all count --
// only FAILED/CANCELLED refund rows are excluded, since those never
// actually took money back out). Passing an already-completed amount
// larger than effectivePaidValue would be a pre-existing data bug this
// function surfaces (returns 0, never negative) rather than masks.
export function remainingRefundableForItem(effectivePaidValue: number, priorRefundAmounts: number[]): number {
  const alreadyClaimed = round2(priorRefundAmounts.reduce((s, a) => s + a, 0))
  return Math.max(0, round2(effectivePaidValue - alreadyClaimed))
}

// The refundable ceiling for the whole invoice: what was actually
// collected, less what's already been refunded or is already in flight
// as a pending refund request. Mirrors lib/invoice/backorder.ts's
// computeCompensationSplit's own amountPaid cap, generalized to also
// account for other pending requests (that function only ever handles
// one compensation at a time, so it didn't need to).
export function remainingRefundableForInvoice(
  amountPaid: number,
  amountRefunded: number,
  pendingRefundAmounts: number[]
): number {
  const pending = round2(pendingRefundAmounts.reduce((s, a) => s + a, 0))
  return Math.max(0, round2(amountPaid - amountRefunded - pending))
}

// Dollar amount for refunding a specific quantity off a multi-unit line,
// derived from that line's own effective (post-allocation) paid value --
// never a separate stored per-unit field, so it can never drift from the
// line's real total. quantityToRefund must be a positive integer <=
// item.quantity; callers are responsible for further capping this
// against remainingRefundableForItem.
export function quantityRefundAmount(effectivePaidValue: number, itemQuantity: number, quantityToRefund: number): number {
  if (itemQuantity <= 0) return 0
  const perUnit = effectivePaidValue / itemQuantity
  return round2(perUnit * quantityToRefund)
}
