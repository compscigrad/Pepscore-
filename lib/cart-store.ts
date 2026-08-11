// Client-side cart state using Zustand with localStorage persistence
// This is a 'use client' module — do not import from server components

'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

// A product can now have more than one cart line (e.g. a Standard Case AND
// an Individual Vial of the same product) -- every line-targeting operation
// (add/remove/update) must match on productId AND sellUnit together, never
// productId alone, or two genuinely different lines would collide into one.
// null and undefined are treated as the same "Standard Case, no tier
// selected" identity so a pre-3C persisted cart (no sellUnit at all) still
// matches correctly.
function sameLine(a: { id: string; sellUnit?: SellUnit | null }, id: string, sellUnit?: SellUnit | null): boolean {
  return a.id === id && (a.sellUnit ?? null) === (sellUnit ?? null)
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  // quantity is optional and means "how many to add" (default 1) -- every
  // pre-existing call site omits it and keeps adding exactly one at a time;
  // Buy Again/Reorder (Phase 3C) is the first caller that needs to add a
  // historical quantity in one action.
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (id: string, sellUnit?: SellUnit | null) => void
  updateQuantity: (id: string, quantity: number, sellUnit?: SellUnit | null) => void
  clearCart: () => void
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  total: () => number
  count: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (newItem) => {
        const addQty = newItem.quantity ?? 1
        // Single choke point for every "add to cart" call site (product
        // page, Buy Again/reorder) -- fired once per action here rather
        // than at each caller, since a caller could otherwise be missed.
        trackEvent(AnalyticsEvent.ADD_TO_CART, {
          slug: newItem.slug,
          sellUnit: newItem.sellUnit ?? null,
          quantity: addQty,
        })
        set((state) => {
          const existing = state.items.find((i) => sameLine(i, newItem.id, newItem.sellUnit))
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, newItem.id, newItem.sellUnit) ? { ...i, quantity: i.quantity + addQty } : i
              ),
            }
          }
          return { items: [...state.items, { ...newItem, quantity: addQty }] }
        })
      },

      removeItem: (id, sellUnit) =>
        set((state) => ({ items: state.items.filter((i) => !sameLine(i, id, sellUnit)) })),

      updateQuantity: (id, quantity, sellUnit) => {
        if (quantity <= 0) {
          get().removeItem(id, sellUnit)
          return
        }
        set((state) => ({
          items: state.items.map((i) => (sameLine(i, id, sellUnit) ? { ...i, quantity } : i)),
        }))
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      total: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      count: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'pepscore-cart' }
  )
)
