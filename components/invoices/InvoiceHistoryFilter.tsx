// Month/Year picker + "All" toggle for invoice history views (Customer
// Portal's /account/invoices and the admin customer profile's Invoices
// section). Pure URL-driven navigation -- no client fetch of its own -- so
// the page it's mounted on stays a plain server component that reads
// searchParams, matching how both host pages already render.
'use client'

import { useRouter } from 'next/navigation'
import { input, selectOption } from './theme'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  basePath: string
  month: number
  year: number
  isAll: boolean
  minYear: number
  maxYear: number
}

export function InvoiceHistoryFilter({ basePath, month, year, isAll, minYear, maxYear }: Props) {
  const router = useRouter()

  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)
  // The current month/year is always selectable even if this customer has
  // no invoices in it yet -- otherwise switching back to "this month" from
  // "All" could land on a year missing from the dropdown.
  const now = new Date()
  const thisYear = now.getUTCFullYear()
  if (!years.includes(thisYear)) years.unshift(thisYear)
  years.sort((a, b) => b - a)

  function go(nextMonth: number, nextYear: number) {
    router.push(`${basePath}?month=${nextMonth}&year=${nextYear}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={month}
        disabled={isAll}
        onChange={(e) => go(Number(e.target.value), year)}
        className={`${input} disabled:opacity-40`}
        aria-label="Month"
      >
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1} className={selectOption}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={year}
        disabled={isAll}
        onChange={(e) => go(month, Number(e.target.value))}
        className={`${input} disabled:opacity-40`}
        aria-label="Year"
      >
        {years.map((y) => (
          <option key={y} value={y} className={selectOption}>
            {y}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => router.push(`${basePath}?period=all`)}
        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
          isAll ? 'border-gold/40 bg-gold/10 text-gold-light' : 'border-white/15 text-white/60 hover:bg-white/5'
        }`}
      >
        All
      </button>
    </div>
  )
}
