import { BackorderIndicator } from './BackorderIndicator'
import { STOREFRONT_BACKORDER_CREDIT_AMOUNT, STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL } from '@/lib/storefront/backorderPolicy'

// Restrained legend explaining the dot marker + the compensation policy.
// Customer-facing wording uses "Produced to Order" / "service credit"
// throughout (2026-08-15 fulfillment/availability sprint) -- the
// underlying InvoiceDiscount label (lib/backorders.ts's
// BACKORDER_COMPENSATION_LABEL, "Backorder Service Credit") stays exactly
// as-is since it's internal/accounting terminology, not this component's
// concern; never "coupon," since this isn't implemented as a coupon/code
// system.
//
// Estimated-fulfillment-time sentence (owner spec, 2026-08-13): every
// customer-facing surface that shows a Produced-to-Order line must
// disclose the ~2-week estimate before checkout, not just the credit
// terms -- added here since this component is the one place already
// rendered on every such surface (ProductDetail, CartSidebar, CheckoutForm).
export function BackorderLegend() {
  return (
    <div className="flex items-start gap-2.5 text-[12px] text-white/50 leading-relaxed">
      <BackorderIndicator className="mt-1" />
      <p>
        <span aria-hidden="true">⌛</span> Items marked with this symbol are produced to order — estimated
        fulfillment is approximately two weeks while a new batch is produced to fulfill your order. Qualifying orders
        over ${STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL} that contain a Produced-to-Order item receive a one-time $
        {STOREFRONT_BACKORDER_CREDIT_AMOUNT} service credit, applied once per order.
      </p>
    </div>
  )
}
