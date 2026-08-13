// Finance page date-range resolution (spec #33: This month / Last month /
// Quarter / Year / Custom range). Pure, server-safe -- no client-only APIs.
import type { DateRange } from '@/lib/finance/reports'

export type FinanceRangeKey = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM'

export interface ResolvedFinanceRange extends DateRange {
  key: FinanceRangeKey
  label: string
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

// Parses a plain "YYYY-MM-DD" (the shape a <input type="date"> always
// sends) as LOCAL midnight -- new Date("YYYY-MM-DD") parses as UTC
// midnight per spec, which silently rolls back a day in any timezone
// behind UTC once startOfDay() reads its local date components. Returns
// null for anything that isn't exactly that shape, same as a parse failure.
function parseLocalDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

export function resolveFinanceRange(params: { range?: string; from?: string; to?: string }, now: Date = new Date()): ResolvedFinanceRange {
  const key = (params.range as FinanceRangeKey) ?? 'THIS_MONTH'

  if (key === 'CUSTOM' && params.from && params.to) {
    const fromParsed = parseLocalDateOnly(params.from)
    const toParsed = parseLocalDateOnly(params.to)
    const from = fromParsed ? startOfDay(fromParsed) : null
    const to = toParsed ? endOfDay(toParsed) : null
    if (from && to) {
      return { key: 'CUSTOM', label: `${params.from} to ${params.to}`, from, to }
    }
  }

  if (key === 'LAST_MONTH') {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))
    return { key, label: 'Last Month', from, to }
  }
  if (key === 'THIS_QUARTER') {
    const q = Math.floor(now.getMonth() / 3)
    const from = startOfDay(new Date(now.getFullYear(), q * 3, 1))
    const to = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0))
    return { key, label: 'This Quarter', from, to }
  }
  if (key === 'THIS_YEAR') {
    const from = startOfDay(new Date(now.getFullYear(), 0, 1))
    const to = endOfDay(new Date(now.getFullYear(), 11, 31))
    return { key, label: 'This Year', from, to }
  }

  // Default: THIS_MONTH
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
  const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return { key: 'THIS_MONTH', label: 'This Month', from, to }
}
