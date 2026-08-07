'use client'

// Client component: needs live search/filter over the full product list
// (spec: "Search and filter records," "Identify products awaiting
// initialization," "Identify products requiring pricing review"). Data
// itself is server-fetched once by app/admin/inventory/page.tsx and passed
// in as props -- no client-side data fetching here.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { InventoryOverviewRow } from '@/lib/adminInventory'

const INVENTORY_STATUS_LABEL: Record<string, string> = {
  TRACKING_DISABLED: 'Tracking Off',
  AWAITING_INITIALIZATION: 'Awaiting Init.',
  IN_STOCK: 'In Stock',
  LOW_STOCK: 'Low Stock',
  OUT_OF_STOCK: 'Out of Stock',
}
const INVENTORY_STATUS_STYLE: Record<string, string> = {
  TRACKING_DISABLED: 'bg-gray-100 text-gray-400',
  AWAITING_INITIALIZATION: 'bg-amber-100 text-amber-700',
  IN_STOCK: 'bg-green-100 text-green-700',
  LOW_STOCK: 'bg-orange-100 text-orange-700',
  OUT_OF_STOCK: 'bg-red-100 text-red-600',
}

function Pill({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ${className}`}>{label}</span>
}

function formatCurrency(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type FilterKey = 'ALL' | 'AWAITING_INITIALIZATION' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'NEEDS_PRICING_REVIEW'

export function AdminInventoryTable({ rows }: { rows: InventoryOverviewRow[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('ALL')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (q && !`${row.product.name} ${row.product.size} ${row.product.sku ?? ''}`.toLowerCase().includes(q)) return false
      if (filter === 'NEEDS_PRICING_REVIEW') return row.needsPricingReview
      if (filter !== 'ALL') return row.product.inventoryStatus === filter
      return true
    })
  }, [rows, query, filter])

  const filterCounts = useMemo(
    () => ({
      AWAITING_INITIALIZATION: rows.filter((r) => r.product.inventoryStatus === 'AWAITING_INITIALIZATION').length,
      LOW_STOCK: rows.filter((r) => r.product.inventoryStatus === 'LOW_STOCK').length,
      OUT_OF_STOCK: rows.filter((r) => r.product.inventoryStatus === 'OUT_OF_STOCK').length,
      NEEDS_PRICING_REVIEW: rows.filter((r) => r.needsPricingReview).length,
    }),
    [rows]
  )

  return (
    <div className="bg-white rounded-2xl shadow-sh overflow-hidden">
      <div className="p-6 border-b border-g100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-[17px] font-bold text-dark">Products</h2>
          <p className="text-[12px] text-g500 mt-0.5">{filtered.length} of {rows.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, strength, SKU…"
            className="rounded-lg border border-g100 px-3 py-2 text-[13px] w-56"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} className="rounded-lg border border-g100 px-3 py-2 text-[13px]">
            <option value="ALL">All statuses</option>
            <option value="AWAITING_INITIALIZATION">Awaiting Initialization ({filterCounts.AWAITING_INITIALIZATION})</option>
            <option value="LOW_STOCK">Low Stock ({filterCounts.LOW_STOCK})</option>
            <option value="OUT_OF_STOCK">Out of Stock ({filterCounts.OUT_OF_STOCK})</option>
            <option value="NEEDS_PRICING_REVIEW">Needs Pricing Review ({filterCounts.NEEDS_PRICING_REVIEW})</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-g100">
              {['Product', 'SKU', 'Inventory', 'Available', 'Cases', 'Backordered', 'Standard', 'SPA', 'Individual', ''].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 px-4 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.product.id} className="border-b border-g100 hover:bg-g100/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/inventory/${row.product.id}`} className="font-semibold text-dark hover:text-gold-dark hover:underline">
                    {row.product.name}
                  </Link>
                  <span className="text-g500 ml-1.5">{row.product.size}</span>
                  {row.needsPricingReview && <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mt-0.5">Needs Pricing Review</div>}
                </td>
                <td className="px-4 py-3 text-g500 whitespace-nowrap">{row.product.sku ?? '—'}</td>
                <td className="px-4 py-3">
                  <Pill label={INVENTORY_STATUS_LABEL[row.product.inventoryStatus]} className={INVENTORY_STATUS_STYLE[row.product.inventoryStatus]} />
                </td>
                <td className="px-4 py-3 font-heading font-bold text-dark whitespace-nowrap">{row.availableUnits ?? '—'}</td>
                <td className="px-4 py-3 text-g500 whitespace-nowrap">{row.completeCasesAvailable ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.backorderedVials > 0 ? <span className="font-bold text-red-600">{row.backorderedVials}</span> : <span className="text-g300">0</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(row.effectiveStandardPrice)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(row.effectiveSpaPrice)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {row.product.individualSalesEnabled ? (
                    formatCurrency(row.effectiveIndividualPrice)
                  ) : row.product.activeIndividualVialPrice !== null ? (
                    <span className="text-[11px] text-g500 italic">Stored — disabled</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link href={`/admin/inventory/${row.product.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                    Manage →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-16 text-g500">No products match this filter.</div>}
      </div>
    </div>
  )
}
