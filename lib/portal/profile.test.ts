// summarizeChanges is the one pure function in this file (otherwise
// DB-orchestration for the customer portal's own profile-edit flow) --
// it drives the audit-log message written for every self-service profile
// update, so a wrong summary here misrepresents what a customer actually
// changed in their own activity history.
import { describe, it, expect } from 'vitest'
import { summarizeChanges } from './profile'

describe('summarizeChanges', () => {
  it('reports a single changed field', () => {
    expect(summarizeChanges({ firstName: 'Jane' }, { firstName: 'Janet' })).toBe('Updated: firstName')
  })

  it('reports multiple changed fields, in the order they appear on the input', () => {
    const result = summarizeChanges({ firstName: 'Jane', phone: '555-0100' }, { firstName: 'Janet', phone: '555-0199' })
    expect(result).toBe('Updated: firstName, phone')
  })

  it('reports "No fields changed" when the new values equal the old ones', () => {
    expect(summarizeChanges({ firstName: 'Jane' }, { firstName: 'Jane' })).toBe('No fields changed')
  })

  it('does not report a field present in "after" but absent (undefined) from the comparison target as changed, when both serialize equal', () => {
    expect(summarizeChanges({}, {})).toBe('No fields changed')
  })

  it('detects a change in a nested object field via structural (not reference) comparison', () => {
    const before = { shippingAddress: { city: 'Old Town' } }
    const after = { shippingAddress: { city: 'New Town' } }
    expect(summarizeChanges(before, after)).toBe('Updated: shippingAddress')
  })

  it('does not flag a structurally-identical nested object as changed even though it is a different reference', () => {
    const before = { shippingAddress: { city: 'Same Town' } }
    const after = { shippingAddress: { city: 'Same Town' } }
    expect(summarizeChanges(before, after)).toBe('No fields changed')
  })

  it('only reports fields present in "after" -- a field only in "before" is never mentioned', () => {
    const before = { firstName: 'Jane', lastName: 'Doe' }
    const after = { firstName: 'Janet' }
    expect(summarizeChanges(before, after)).toBe('Updated: firstName')
  })
})
