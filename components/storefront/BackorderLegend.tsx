import { BackorderIndicator } from './BackorderIndicator'
import { STOREFRONT_BACKORDER_CREDIT_AMOUNT, STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL } from '@/lib/storefront/backorderPolicy'

// Restrained legend explaining the dot marker + the compensation policy,
// in the same customer-facing term ("credit") the admin side already uses
// for the underlying InvoiceDiscount label (lib/backorders.ts's
// BACKORDER_COMPENSATION_LABEL, "Backorder Service Credit") -- never
// "coupon," since this isn't implemented as a coupon/code system.
export function BackorderLegend() {
  return (
    <div className="flex items-start gap-2.5 text-[12px] text-white/50 leading-relaxed">
      <BackorderIndicator className="mt-1" />
      <p>
        Items marked with this symbol are currently awaiting restock and may require additional fulfillment time.
        Qualifying orders over ${STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL} that contain a backordered item receive a
        one-time ${STOREFRONT_BACKORDER_CREDIT_AMOUNT} backorder credit.
      </p>
    </div>
  )
}
