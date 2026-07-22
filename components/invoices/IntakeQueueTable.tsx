// Intake Queue — every intake-originated DRAFT invoice, sortable/searchable
// client-side (the queue is inherently small: it's just drafts still
// awaiting admin follow-up, not the full invoice history InvoiceTable.tsx
// paginates through), one row per invoice linking to its edit page.
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { card, input, selectOption } from './theme'

export interface IntakeQueueRow {
  id: string
  invoiceNumber: string
  customerName: string
  customerId: string | null
  intakeSubmittedAt: string | Date
  priority: 'LOW' | 'NORMAL' | 'HIGH'
}

type SortBy = 'oldest' | 'newest' | 'priority' | 'customerName'

const PRIORITY_RANK: Record<IntakeQueueRow['priority'], number> = { HIGH: 2, NORMAL: 1, LOW: 0 }

const PRIORITY_BADGE: Record<IntakeQueueRow['priority'], string> = {
  HIGH: 'bg-red-500/15 text-red-300 border-red-400/30',
  NORMAL: 'bg-white/10 text-white/60 border-white/15',
  LOW: 'bg-white/5 text-white/40 border-white/10',
}

interface Props {
  initialRows: IntakeQueueRow[]
}

export function IntakeQueueTable({ initialRows }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('oldest')

  const rows = useMemo(() => {
    const filtered = search
      ? initialRows.filter((r) => r.customerName.toLowerCase().includes(search.toLowerCase()))
      : initialRows

    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
      if (sortBy === 'customerName') return a.customerName.localeCompare(b.customerName)
      const aTime = new Date(a.intakeSubmittedAt).getTime()
      const bTime = new Date(b.intakeSubmittedAt).getTime()
      return sortBy === 'newest' ? bTime - aTime : aTime - bTime
    })
  }, [initialRows, search, sortBy])

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="font-heading text-[17px] font-bold text-white">Awaiting Follow-Up</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer..."
            className={`${input} sm:w-64`}
            aria-label="Search intake queue"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className={input}
            aria-label="Sort intake queue"
          >
            <option value="oldest" className={selectOption}>
              Oldest first
            </option>
            <option value="newest" className={selectOption}>
              Newest first
            </option>
            <option value="priority" className={selectOption}>
              Priority
            </option>
            <option value="customerName" className={selectOption}>
              Customer name
            </option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">
                Invoice #
              </th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">
                Customer
              </th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">
                Submitted
              </th>
              <th className="text-left px-4 py-3 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">
                Priority
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/50 text-sm">
                  No submissions awaiting follow-up.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-white/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{row.invoiceNumber}</td>
                  <td className="px-4 py-3 text-white/70">{row.customerName}</td>
                  <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                    {new Date(row.intakeSubmittedAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${PRIORITY_BADGE[row.priority]}`}
                    >
                      {row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/invoices/${row.id}`} className="text-gold-light font-bold text-sm hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
