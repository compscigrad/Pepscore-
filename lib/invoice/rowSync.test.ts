import { describe, it, expect } from 'vitest'
import { planRowSync } from './rowSync'

describe('planRowSync', () => {
  it('updates a row whose id matches an existing row', () => {
    const existing = [{ id: 'a' }, { id: 'b' }]
    const payload = [{ id: 'a', name: 'A updated' }, { id: 'b', name: 'B updated' }]
    const plan = planRowSync(existing, payload)
    expect(plan.toUpdate).toEqual([
      { id: 'a', payload: { id: 'a', name: 'A updated' } },
      { id: 'b', payload: { id: 'b', name: 'B updated' } },
    ])
    expect(plan.toCreate).toEqual([])
    expect(plan.toDeleteIds).toEqual([])
  })

  it('creates a row with no id', () => {
    const existing = [{ id: 'a' }]
    const payload = [{ id: 'a' }, { id: null, name: 'new row' }]
    const plan = planRowSync(existing, payload)
    expect(plan.toCreate).toEqual([{ id: null, name: 'new row' }])
    expect(plan.toDeleteIds).toEqual([])
  })

  it('deletes an existing row omitted from the payload', () => {
    const existing = [{ id: 'a' }, { id: 'b' }]
    const payload = [{ id: 'a' }]
    const plan = planRowSync(existing, payload)
    expect(plan.toDeleteIds).toEqual(['b'])
  })

  it('treats an id that does not belong to this invoice as a new row, not an update', () => {
    const existing = [{ id: 'a' }]
    const payload = [{ id: 'some-other-invoices-row' }]
    const plan = planRowSync(existing, payload)
    expect(plan.toUpdate).toEqual([])
    expect(plan.toCreate).toEqual([{ id: 'some-other-invoices-row' }])
    // The real existing row, no longer referenced by any payload entry, is deleted.
    expect(plan.toDeleteIds).toEqual(['a'])
  })

  it('treats a duplicated id in the payload as one update and one new row', () => {
    const existing = [{ id: 'a' }]
    const payload = [{ id: 'a', name: 'first' }, { id: 'a', name: 'duplicate' }]
    const plan = planRowSync(existing, payload)
    expect(plan.toUpdate).toEqual([{ id: 'a', payload: { id: 'a', name: 'first' } }])
    expect(plan.toCreate).toEqual([{ id: 'a', name: 'duplicate' }])
  })

  it('handles a totally fresh invoice (no existing rows)', () => {
    const plan = planRowSync([], [{ id: null, name: 'brand new' }])
    expect(plan.toUpdate).toEqual([])
    expect(plan.toCreate).toEqual([{ id: null, name: 'brand new' }])
    expect(plan.toDeleteIds).toEqual([])
  })

  it('handles clearing all rows (empty payload)', () => {
    const existing = [{ id: 'a' }, { id: 'b' }]
    const plan = planRowSync(existing, [])
    expect(plan.toDeleteIds).toEqual(['a', 'b'])
    expect(plan.toUpdate).toEqual([])
    expect(plan.toCreate).toEqual([])
  })
})
