// Subtle backorder marker (Phase 2B correction, 2026-08-07) -- deliberately
// NOT a large "BACKORDER" banner. A small dot beside product metadata,
// with an accessible label and tooltip, used consistently everywhere a
// backordered product/line appears: ProductCard, search results, category
// pages, product detail, cart line items. Never relies on color alone --
// screen-reader text and a title tooltip both carry the meaning too.
export function BackorderIndicator({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-[7px] h-[7px] rounded-full bg-amber-400 shrink-0 ${className}`}
      title="Backordered — awaiting restock, may require additional fulfillment time"
      role="img"
      aria-label="Backordered item"
    />
  )
}
