import { describe, it, expect } from 'vitest'
import { computeOrderStatus } from './orderStatus'

describe('computeOrderStatus', () => {
  it('completes the order when paid and delivered', () => {
    expect(computeOrderStatus('ISSUED', 'PAID', 'DELIVERED', 'IN_PROGRESS')).toBe('COMPLETED')
  })

  it('does NOT complete a delivered order that is still unpaid', () => {
    expect(computeOrderStatus('ISSUED', 'UNPAID', 'DELIVERED', 'IN_PROGRESS')).toBe('IN_PROGRESS')
  })

  it('does NOT complete a delivered order that is only partially paid', () => {
    expect(computeOrderStatus('PENDING', 'PARTIALLY_PAID', 'DELIVERED', 'IN_PROGRESS')).toBe('IN_PROGRESS')
  })

  it('marks the order in progress once shipping starts, even if unpaid', () => {
    expect(computeOrderStatus('ISSUED', 'UNPAID', 'IN_TRANSIT', 'OPEN')).toBe('IN_PROGRESS')
  })

  it('marks the order in progress once partially paid, even if not shipped', () => {
    expect(computeOrderStatus('PENDING', 'PARTIALLY_PAID', 'NOT_SHIPPED', 'OPEN')).toBe('IN_PROGRESS')
  })

  it('stays open when nothing has happened yet', () => {
    expect(computeOrderStatus('DRAFT', 'UNPAID', 'NOT_SHIPPED', 'OPEN')).toBe('OPEN')
  })

  it('cancels the order when the invoice itself is cancelled', () => {
    expect(computeOrderStatus('CANCELLED', 'UNPAID', 'IN_TRANSIT', 'IN_PROGRESS')).toBe('CANCELLED')
  })

  it('cancels the order when the shipment itself is cancelled', () => {
    expect(computeOrderStatus('ISSUED', 'PAID', 'CANCELLED', 'IN_PROGRESS')).toBe('CANCELLED')
  })

  it('never downgrades an already-completed order from a later, unrelated event', () => {
    expect(computeOrderStatus('ISSUED', 'PAID', 'RETURNED_TO_SENDER', 'COMPLETED')).toBe('COMPLETED')
  })

  it('void invoices cancel the order the same as a cancelled invoice', () => {
    expect(computeOrderStatus('VOID', 'UNPAID', 'NOT_SHIPPED', 'OPEN')).toBe('CANCELLED')
  })
})
