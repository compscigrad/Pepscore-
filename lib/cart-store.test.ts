// @vitest-environment jsdom
//
// No test coverage existed for this file before (2026-08-18
// launch-readiness audit) despite it carrying real, non-trivial logic --
// sellUnit-aware line matching, quantity merge/removal, total/count
// computation. jsdom needed for zustand/middleware's persist (reads/
// writes localStorage).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/analytics/track', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/analytics/productEngagementClient', () => ({ trackProductEngagement: vi.fn() }))

import { useCartStore } from './cart-store'

const ITEM_A = { id: 'p1', slug: 'semaglutide-5mg', name: 'Semaglutide', size: '5mg', price: 89, imageUrl: '/x.png' }
const ITEM_B = { id: 'p2', slug: 'tirzepatide-10mg', name: 'Tirzepatide', size: '10mg', price: 120, imageUrl: '/y.png' }

beforeEach(() => {
  useCartStore.setState({ items: [], isOpen: false })
  vi.clearAllMocks()
})

describe('cart-store addItem', () => {
  it('adds a new line with quantity defaulting to 1', () => {
    useCartStore.getState().addItem(ITEM_A)
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'p1', quantity: 1 })
  })

  it('adds with an explicit quantity', () => {
    useCartStore.getState().addItem({ ...ITEM_A, quantity: 3 })
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('merges quantity when adding the same id + sellUnit again', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().addItem(ITEM_A)
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
  })

  it('keeps separate lines for the same id under different sellUnits', () => {
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: 'CASE_STANDARD' })
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: 'INDIVIDUAL_VIAL' })
    expect(useCartStore.getState().items).toHaveLength(2)
  })

  it('treats null and undefined sellUnit as the same line identity', () => {
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: undefined })
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: null })
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
  })

  it('adds a second distinct product as its own line', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().addItem(ITEM_B)
    expect(useCartStore.getState().items).toHaveLength(2)
  })
})

describe('cart-store removeItem', () => {
  it('removes only the matching line', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().addItem(ITEM_B)
    useCartStore.getState().removeItem('p1')
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('p2')
  })

  it('does not remove a different sellUnit line for the same product', () => {
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: 'CASE_STANDARD' })
    useCartStore.getState().addItem({ ...ITEM_A, sellUnit: 'INDIVIDUAL_VIAL' })
    useCartStore.getState().removeItem('p1', 'CASE_STANDARD')
    const items = useCartStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].sellUnit).toBe('INDIVIDUAL_VIAL')
  })
})

describe('cart-store updateQuantity', () => {
  it('updates the quantity of the matching line', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().updateQuantity('p1', 5)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
  })

  it('removes the line when quantity is set to 0', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().updateQuantity('p1', 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('removes the line when quantity is negative', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().updateQuantity('p1', -1)
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})

describe('cart-store derived values', () => {
  it('total() sums price * quantity across all lines', () => {
    useCartStore.getState().addItem({ ...ITEM_A, quantity: 2 }) // 89*2 = 178
    useCartStore.getState().addItem({ ...ITEM_B, quantity: 1 }) // 120*1 = 120
    expect(useCartStore.getState().total()).toBe(298)
  })

  it('count() sums quantity across all lines', () => {
    useCartStore.getState().addItem({ ...ITEM_A, quantity: 2 })
    useCartStore.getState().addItem({ ...ITEM_B, quantity: 3 })
    expect(useCartStore.getState().count()).toBe(5)
  })

  it('total() and count() are 0 for an empty cart', () => {
    expect(useCartStore.getState().total()).toBe(0)
    expect(useCartStore.getState().count()).toBe(0)
  })
})

describe('cart-store open/close', () => {
  it('openCart/closeCart/toggleCart control isOpen', () => {
    expect(useCartStore.getState().isOpen).toBe(false)
    useCartStore.getState().openCart()
    expect(useCartStore.getState().isOpen).toBe(true)
    useCartStore.getState().closeCart()
    expect(useCartStore.getState().isOpen).toBe(false)
    useCartStore.getState().toggleCart()
    expect(useCartStore.getState().isOpen).toBe(true)
  })
})

describe('cart-store clearCart', () => {
  it('empties all items', () => {
    useCartStore.getState().addItem(ITEM_A)
    useCartStore.getState().addItem(ITEM_B)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toEqual([])
  })
})
