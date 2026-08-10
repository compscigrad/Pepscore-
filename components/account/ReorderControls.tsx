// Phase 3C: Buy Again / Reorder All. Never touches checkout/payment directly
// -- these only ever add lines to the same client-side cart ProductDetail.tsx
// uses (Add to Cart -> Cart -> Review -> Checkout, customer still authorizes
// every purchase). All pricing/eligibility here was already resolved
// server-side by resolveReorderLine() (lib/storefront/reorder.ts) against the
// CURRENT product, never a historical snapshot.
'use client'

import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { REORDER_UNAVAILABLE_MESSAGE, type ResolvedReorderLine } from '@/lib/storefront/reorder'

export interface ReorderLineView {
  key: string
  productId: string
  slug: string
  name: string
  size: string
  imageUrl: string
  resolved: ResolvedReorderLine
}

function toCartItem(line: ReorderLineView, resolved: Extract<ResolvedReorderLine, { status: 'RESOLVED' }>) {
  return {
    id: line.productId,
    slug: line.slug,
    name: line.name,
    size: line.size,
    price: resolved.unitPrice,
    imageUrl: line.imageUrl,
    backordered: resolved.backordered,
    sellUnit: resolved.sellUnit,
    unitsPerSellUnit: resolved.unitsPerSellUnit,
    quantity: resolved.quantity,
  }
}

export function BuyAgainButton({ line }: { line: ReorderLineView }) {
  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.openCart)
  const resolved = line.resolved

  if (resolved.status !== 'RESOLVED') {
    return <span className="text-white/30 text-[11px]">{REORDER_UNAVAILABLE_MESSAGE[resolved.reason]}</span>
  }

  function handleClick() {
    if (resolved.status !== 'RESOLVED') return
    addItem(toCartItem(line, resolved))
    toast.success(`${line.name} added to cart`)
    openCart()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-gold-light hover:text-gold text-[11px] font-heading font-bold uppercase tracking-[0.06em]"
    >
      Buy Again{resolved.backordered ? ' (Backorder)' : ''}
    </button>
  )
}

export function ReorderAllButton({ lines }: { lines: ReorderLineView[] }) {
  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.openCart)
  const resolvable = lines.filter(
    (l): l is ReorderLineView & { resolved: Extract<ResolvedReorderLine, { status: 'RESOLVED' }> } =>
      l.resolved.status === 'RESOLVED'
  )

  if (resolvable.length === 0) return null

  function handleClick() {
    for (const line of resolvable) {
      addItem(toCartItem(line, line.resolved))
    }
    toast.success(resolvable.length === 1 ? `${resolvable[0].name} added to cart` : `${resolvable.length} items added to cart`)
    openCart()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[11px] font-bold tracking-[0.06em] uppercase px-4 py-2 rounded-full transition-all"
    >
      Reorder All
    </button>
  )
}
