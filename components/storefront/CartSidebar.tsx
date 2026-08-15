// Slide-out cart sidebar with items, quantity controls, and checkout button
// Opens/closes via Zustand cart store
'use client'

import Image from 'next/image'
import { X, Minus, Plus, Trash2 } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { useRouter } from 'next/navigation'
import { BackorderIndicator } from './BackorderIndicator'
import { BackorderLegend } from './BackorderLegend'
import { STOREFRONT_BACKORDER_CREDIT_AMOUNT, STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL } from '@/lib/storefront/backorderPolicy'
import { SELL_UNIT_DISPLAY_LABEL } from '@/lib/pricing/sellUnits'

export function CartSidebar() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, total } = useCartStore()
  const router = useRouter()

  const cartTotal = total()
  const hasBackorderedItem = items.some((item) => item.backordered)
  // Storefront-side eligibility hint only -- the authoritative check
  // happens server-side against the real invoice/order once one exists
  // (lib/invoice/backorder.ts's isAutomaticCompensationEligible), never
  // decided here.
  const qualifiesForBackorderCredit = hasBackorderedItem && cartTotal > STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL

  function handleCheckout() {
    closeCart()
    router.push('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 z-[1900] transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCart}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 w-[380px] max-w-full h-screen bg-black z-[2000] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#D4AF37]/15">
          <h3 className="font-heading text-[17px] font-bold text-white">Your Cart</h3>
          <button onClick={closeCart} className="text-white/50 hover:text-white transition-colors" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <span className="text-4xl block mb-3">🧪</span>
              <p className="text-sm leading-relaxed">Your cart is empty.<br />Add some peptides to get started.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map(item => (
                <li key={`${item.id}-${item.sellUnit ?? 'CASE_STANDARD'}`} className="flex gap-3 py-3 border-b border-white/10 items-center">
                  <div className="w-[60px] h-[60px] bg-white/[0.04] rounded-lg overflow-hidden flex-shrink-0 relative">
                    <Image src={item.imageUrl} alt={item.name} fill className="object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-[13px] font-bold truncate text-white flex items-center gap-1.5">
                      {item.name}
                      {item.backordered && <BackorderIndicator />}
                    </p>
                    <p className="text-[12px] text-[#D4AF37] font-semibold">
                      ${item.price.toFixed(2)} / {item.size}
                      {item.sellUnit && item.sellUnit !== 'CASE_STANDARD' && (
                        <span className="text-white/50 font-normal"> · {SELL_UNIT_DISPLAY_LABEL[item.sellUnit]}</span>
                      )}
                    </p>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.sellUnit)}
                        className="w-6 h-6 border border-white/20 text-white/70 rounded flex items-center justify-center hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-black transition-all"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-heading text-[13px] font-bold w-5 text-center text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.sellUnit)}
                        className="w-6 h-6 border border-white/20 text-white/70 rounded flex items-center justify-center hover:bg-[#D4AF37] hover:border-[#D4AF37] hover:text-black transition-all"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id, item.sellUnit)}
                    className="text-white/30 hover:text-red-500 transition-colors p-1 flex-shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with total + checkout */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-[#D4AF37]/15">
            <div className="flex justify-between items-center mb-3">
              <span className="font-heading font-bold text-[15px] text-white">Total</span>
              <span className="font-heading font-extrabold text-[19px] text-[#D4AF37]">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-white/45 mb-3 leading-relaxed">
              Shipping and taxes calculated at checkout. Free shipping on orders over $150.
            </p>
            {hasBackorderedItem && (
              <div className="mb-3 space-y-1.5">
                <BackorderLegend />
                <p className="text-[11px] text-white/45">
                  {qualifiesForBackorderCredit
                    ? `This order qualifies for a one-time $${STOREFRONT_BACKORDER_CREDIT_AMOUNT} service credit, applied automatically.`
                    : `Orders over $${STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL} with a Produced-to-Order item receive a one-time $${STOREFRONT_BACKORDER_CREDIT_AMOUNT} service credit.`}
                </p>
              </div>
            )}
            <button
              onClick={handleCheckout}
              className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-full transition-all"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
