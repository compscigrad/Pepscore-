import { describe, it, expect } from 'vitest'
import { formatInvoiceNumber } from './numbering'

// generateSequentialInvoiceNumber() itself is DB-backed (an atomic
// upsert-increment + existence check against prisma.invoice) and is
// exercised against a real isolated database via rehearsal scripts, the
// same pattern used elsewhere in this codebase for DB-dependent behavior
// (collision safety under concurrent calls, the per-year counter's
// catch-up loop, year rollover creating a fresh counter row) — this file
// covers the pure string-formatting piece.
describe('formatInvoiceNumber', () => {
  it('formats a two-digit year with no leading zeros on the sequence', () => {
    expect(formatInvoiceNumber(2026, 25)).toBe('PS-26-25')
  })

  it('drops leading zeros entirely — sequence 1 is "1", not "001" or "000001"', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('PS-26-1')
  })

  it('does not zero-pad or truncate a large sequence number', () => {
    expect(formatInvoiceNumber(2026, 1204)).toBe('PS-26-1204')
  })

  it('formats the year rollover correctly — each year is its own independent two-digit prefix', () => {
    expect(formatInvoiceNumber(2027, 1)).toBe('PS-27-1')
    expect(formatInvoiceNumber(2099, 1)).toBe('PS-99-1')
  })

  it('handles a four-digit year outside 2000-2099 by taking the last two digits, consistent with every other year', () => {
    expect(formatInvoiceNumber(2100, 1)).toBe('PS-00-1')
  })
})
