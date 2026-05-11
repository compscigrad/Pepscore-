// Slide-out cart sidebar with items, quantity controls, and checkout button
// Opens/closes via Zustand cart store
'use client'

import Image from 'next/image'
import { X, Minus, Plus, Trash2 } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { useRouter } from 'next/navigation'

export function CartSidebar() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, total } = useCartStore()
  const router = useRouter()

  const cartTotal = total()

  function handleCheckout() {
    closeCart()
    router.push('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-[1900] transition-opacity ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeCart}
      />

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 right-0 w-[380px] max-w-full h-screen bg-white z-[2000] flex flex-col shadow-sl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-g100">
          <h3 className="font-heading text-[17px] font-bold">Your Cart</h3>
          <button onClick={closeCart} className="text-g500 hover:text-dark transition-colors" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="text-center py-16 text-g500">
              <span className="text-4xl block mb-3">🧪</span>
              <p className="text-sm leading-relaxed">Your cart is empty.<br />Add some peptides to get started.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map(item => (
                <li key={item.id} className="flex gap-3 py-3 border-b border-g100 items-center">
                  <div className="w-[60px] h-[60px] bg-cream rounded-lg overflow-hidden flex-shrink-0 relative">
                    <Image src={item.imageUrl} alt={item.name} fill className="object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-[13px] font-bold truncate">{item.name}</p>
                    <p className="text-[12px] text-gold-dark font-semibold">${item.price.toFixed(2)} / {item.size}</p>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 border border-g300 rounded flex items-center justify-center hover:bg-gold hover:border-gold hover:text-white transition-all"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="font-heading text-[13px] font-bold w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 border border-g300 rounded flex items-center justify-center hover:bg-gold hover:border-gold hover:text-white transition-all"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-g300 hover:text-red-500 transition-colors p-1 flex-shrink-0"
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
          <div className="px-6 py-5 border-t border-g100">
            <div className="flex justify-between items-center mb-3">
              <span className="font-heading font-bold text-[15px]">Total</span>
              <span className="font-heading font-extrabold text-[19px] text-gold-dark">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-g500 mb-3 leading-relaxed">
              Shipping and taxes calculated at checkout. Free shipping on orders over $150.
            </p>
            <button
              onClick={handleCheckout}
              className="w-full bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-md transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
