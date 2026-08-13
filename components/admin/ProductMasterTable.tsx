'use client'

// Admin -> Catalog -> Product Master: the one "see every product and every
// pricing/status field in one place" view (2026-08-12 admin optimization
// sprint). Reads from lib/adminProductMaster.ts (itself built on the same
// listInventoryOverview() the existing Inventory page uses -- no second
// catalog query). Every write here goes through the same two routes the
// existing Inventory detail page already uses (/pricing for pricingStatus
// and individualSalesEnabled, /actions for backorderEnabled), then
// router.refresh() -- no new API surface, per the "don't duplicate
// existing systems" instruction. Full field-by-field editing stays on the
// existing /admin/inventory/[id] detail page; this view links there rather
// than re-implementing that editor.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProductMasterRow, PricingSourceStatus } from '@/lib/adminProductMaster'
import { PRICING_SOURCE_LABEL } from '@/lib/adminProductMaster'

function formatCurrency(n: number | null): string {
  if (n === null) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function Pill({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap ${className}`}>{label}</span>
}

const PRICING_SOURCE_STYLE: Record<PricingSourceStatus, string> = {
  NEEDS_REVIEW: 'bg-amber-400/10 text-amber-300',
  MANUAL_OVERRIDE: 'bg-blue-400/10 text-blue-300',
  FORMULA_DERIVED: 'bg-white/5 text-white/50',
}

type FilterKey =
  | 'ALL'
  | 'LIVE'
  | 'ARCHIVED'
  | 'CASE_ENABLED'
  | 'INDIVIDUAL_ENABLED'
  | 'INDIVIDUAL_HIDDEN'
  | 'BACKORDER_ENABLED'
  | 'MISSING_IMAGE'
  | 'MISSING_PRICE'
  | 'NEEDS_PRICING_REVIEW'
  | 'OUT_OF_STOCK'
  | 'LOW_STOCK'

const FILTER_LABEL: Record<FilterKey, string> = {
  ALL: 'All',
  LIVE: 'Live',
  ARCHIVED: 'Archived',
  CASE_ENABLED: 'Case Enabled',
  INDIVIDUAL_ENABLED: 'Individual Enabled',
  INDIVIDUAL_HIDDEN: 'Individual Hidden',
  BACKORDER_ENABLED: 'Backorder Enabled',
  MISSING_IMAGE: 'Missing Image',
  MISSING_PRICE: 'Missing Price',
  NEEDS_PRICING_REVIEW: 'Needs Pricing Review',
  OUT_OF_STOCK: 'Out of Stock',
  LOW_STOCK: 'Low Stock',
}

function matchesFilter(row: ProductMasterRow, filter: FilterKey): boolean {
  switch (filter) {
    case 'ALL': return true
    case 'LIVE': return !row.archived
    case 'ARCHIVED': return row.archived
    case 'CASE_ENABLED': return row.caseEnabled
    case 'INDIVIDUAL_ENABLED': return row.individualPublicEnabled
    case 'INDIVIDUAL_HIDDEN': return row.individualStoredInternal
    case 'BACKORDER_ENABLED': return row.product.backorderEnabled
    case 'MISSING_IMAGE': return !row.imageIsReal
    case 'MISSING_PRICE': return row.missingPrice
    case 'NEEDS_PRICING_REVIEW': return row.needsPricingReview
    case 'OUT_OF_STOCK': return row.product.inventoryStatus === 'OUT_OF_STOCK'
    case 'LOW_STOCK': return row.product.inventoryStatus === 'LOW_STOCK'
  }
}

type SortKey = 'NAME' | 'CATEGORY' | 'STATUS' | 'WHOLESALE' | 'STANDARD' | 'SPA' | 'INDIVIDUAL' | 'INVENTORY' | 'UPDATED'

const SORT_LABEL: Record<SortKey, string> = {
  NAME: 'Name',
  CATEGORY: 'Category',
  STATUS: 'Active / Archived',
  WHOLESALE: 'Wholesale Cost',
  STANDARD: 'Standard Price',
  SPA: 'SPA Price',
  INDIVIDUAL: 'Individual Price',
  INVENTORY: 'Inventory',
  UPDATED: 'Last Updated',
}

function sortValue(row: ProductMasterRow, key: SortKey): string | number {
  switch (key) {
    case 'NAME': return row.product.name.toLowerCase()
    case 'CATEGORY': return row.product.category.toLowerCase()
    case 'STATUS': return row.archived ? 1 : 0
    case 'WHOLESALE': return row.product.supplierCaseCost ?? -1
    case 'STANDARD': return row.effectiveStandardPrice ?? -1
    case 'SPA': return row.effectiveSpaPrice ?? -1
    case 'INDIVIDUAL': return row.effectiveIndividualPrice ?? -1
    case 'INVENTORY': return row.availableUnits ?? -1
    case 'UPDATED': {
      const latest = [row.lastPriceUpdateAt, row.lastInventoryUpdateAt, row.product.updatedAt].filter(Boolean) as (Date | string)[]
      return latest.length ? Math.max(...latest.map((d) => new Date(d).getTime())) : 0
    }
  }
}

async function patchPricing(productId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/inventory/${productId}/pricing`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Update failed')
  }
  return res.json()
}

async function postAction(productId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/inventory/${productId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Action failed')
  }
  return res.json()
}

export function ProductMasterTable({ rows }: { rows: ProductMasterRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('NAME')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const filterCounts = useMemo(() => {
    const counts = {} as Record<FilterKey, number>
    for (const key of Object.keys(FILTER_LABEL) as FilterKey[]) {
      counts[key] = rows.filter((r) => matchesFilter(r, key)).length
    }
    return counts
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = rows.filter((row) => {
      if (q && !`${row.product.name} ${row.product.size} ${row.product.sku ?? ''} ${row.product.category}`.toLowerCase().includes(q)) return false
      return matchesFilter(row, filter)
    })
    return [...base].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return -1 * sortDir
      if (av > bv) return 1 * sortDir
      return 0
    })
  }, [rows, query, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  async function handleToggleArchive(row: ProductMasterRow) {
    const willArchive = !row.archived
    const message = willArchive
      ? `Archive "${row.product.name}" (${row.product.size})? It will be removed from the storefront (grid, search, category pages, sitemap, cart, checkout) but every historical invoice, order, price record, and audit entry stays exactly as-is. Admin will still see it here as Archived.`
      : `Reactivate "${row.product.name}" (${row.product.size})? It will become purchasable on the storefront again with its current stored pricing.`
    if (!window.confirm(message)) return

    setBusyId(row.product.id)
    setRowError(null)
    try {
      await patchPricing(row.product.id, { pricingStatus: willArchive ? 'INACTIVE' : 'ACTIVE', reason: `Toggled from Product Master (${willArchive ? 'archive' : 'reactivate'})` })
      router.refresh()
    } catch (err) {
      setRowError({ id: row.product.id, message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleIndividualPublic(row: ProductMasterRow) {
    const willEnable = !row.individualPublicEnabled
    if (willEnable) {
      const message = `Make Individual Vial sales PUBLIC for "${row.product.name}" (${row.product.size})? It will immediately become purchasable by the vial on the storefront at the currently stored individual price.`
      if (!window.confirm(message)) return
    }
    setBusyId(row.product.id)
    setRowError(null)
    try {
      await patchPricing(row.product.id, { individualSalesEnabled: willEnable, reason: `Toggled from Product Master (individual vial ${willEnable ? 'enabled' : 'hidden'})` })
      router.refresh()
    } catch (err) {
      setRowError({ id: row.product.id, message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleBackorder(row: ProductMasterRow) {
    const willEnable = !row.product.backorderEnabled
    setBusyId(row.product.id)
    setRowError(null)
    try {
      await postAction(row.product.id, { action: 'SET_BACKORDER_ENABLED', backorderEnabled: willEnable })
      router.refresh()
    } catch (err) {
      setRowError({ id: row.product.id, message: err instanceof Error ? err.message : 'Update failed' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
      <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-[17px] font-bold text-white">Product Master</h2>
          <p className="text-[12px] text-white/50 mt-0.5">{filtered.length} of {rows.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, strength, SKU, category…"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 w-64 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterKey)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
          >
            {(Object.keys(FILTER_LABEL) as FilterKey[]).map((key) => (
              <option key={key} value={key} className="bg-white text-dark">
                {FILTER_LABEL[key]} ({filterCounts[key]})
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => toggleSort(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key} className="bg-white text-dark">
                Sort: {SORT_LABEL[key]} {sortKey === key ? (sortDir === 1 ? '↑' : '↓') : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop dense table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/10">
              {['Product', 'Category', 'Status', 'Wholesale', 'SPA', 'Standard', 'Individual', 'Source', 'Case', 'Vial', 'Backorder', 'Image', 'Inventory', 'Updated', ''].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-3 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.product.id} className="border-b border-white/10 hover:bg-white/[0.02] align-top">
                <td className="px-3 py-3">
                  <Link href={`/admin/inventory/${row.product.id}`} className="font-semibold text-white hover:text-gold-dark hover:underline">
                    {row.product.name}
                  </Link>
                  <div className="text-white/50 text-[12px]">{row.product.size} · {row.product.sku ?? 'no SKU'}</div>
                  {rowError?.id === row.product.id && <div className="text-[11px] text-red-400 mt-1">{rowError.message}</div>}
                </td>
                <td className="px-3 py-3 text-white/60 whitespace-nowrap">{row.product.category}</td>
                <td className="px-3 py-3">
                  {row.archived ? <Pill label="Archived" className="bg-red-400/10 text-red-300" /> : <Pill label="Live" className="bg-green-400/10 text-green-300" />}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{formatCurrency(row.product.supplierCaseCost)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={row.spaInvariantViolated ? 'text-red-400 font-bold' : ''}>{formatCurrency(row.effectiveSpaPrice)}</span>
                  {row.spaInvariantViolated && <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide">SPA ≥ Standard</div>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{formatCurrency(row.effectiveStandardPrice)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {row.individualPublicEnabled ? formatCurrency(row.effectiveIndividualPrice)
                    : row.individualStoredInternal ? <span className="text-[11px] text-white/50 italic">Stored — hidden</span>
                    : '—'}
                </td>
                <td className="px-3 py-3">
                  <Pill label={PRICING_SOURCE_LABEL[row.pricingSourceStatus]} className={PRICING_SOURCE_STYLE[row.pricingSourceStatus]} />
                </td>
                <td className="px-3 py-3">
                  {/* Case enablement is derived from whether an active
                      Standard Case price is set, not a standalone boolean --
                      setting/clearing that price requires the full pricing
                      editor (a $0 case price is meaningfully different from
                      "no case price"), so this is a status indicator, not a
                      quick toggle. */}
                  {row.caseEnabled ? <Pill label="On" className="bg-green-400/10 text-green-300" /> : <Pill label="Off" className="bg-white/5 text-white/40" />}
                </td>
                <td className="px-3 py-3">
                  <button
                    disabled={busyId === row.product.id}
                    onClick={() => handleToggleIndividualPublic(row)}
                    className={`text-[11px] font-heading font-bold uppercase tracking-wide disabled:opacity-40 ${row.individualPublicEnabled ? 'text-green-300' : 'text-white/50 hover:text-gold'}`}
                  >
                    {row.individualPublicEnabled ? 'Public' : row.individualStoredInternal ? 'Hidden' : 'Off'}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <button
                    disabled={busyId === row.product.id}
                    onClick={() => handleToggleBackorder(row)}
                    className={`text-[11px] font-heading font-bold uppercase tracking-wide disabled:opacity-40 ${row.product.backorderEnabled ? 'text-green-300' : 'text-white/50 hover:text-gold'}`}
                  >
                    {row.product.backorderEnabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td className="px-3 py-3">
                  {row.imageIsReal ? <Pill label="Real" className="bg-white/5 text-white/50" /> : <Pill label="Missing" className="bg-amber-400/10 text-amber-300" />}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-white/60">{row.availableUnits ?? '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap text-white/40 text-[12px]">{formatDate(row.lastPriceUpdateAt)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <button
                    disabled={busyId === row.product.id}
                    onClick={() => handleToggleArchive(row)}
                    className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/70 hover:text-red-300 disabled:opacity-40 mr-3"
                  >
                    {row.archived ? 'Reactivate' : 'Archive'}
                  </button>
                  <Link href={`/admin/inventory/${row.product.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-16 text-white/50">No products match this filter.</div>}
      </div>

      {/* Compact card layout below lg -- Product Master's column count doesn't
          fit a legible table on tablet/phone; horizontal scroll is reserved
          for the desktop table above, not forced here. */}
      <div className="lg:hidden divide-y divide-white/10">
        {filtered.map((row) => (
          <div key={row.product.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/admin/inventory/${row.product.id}`} className="font-semibold text-white hover:text-gold-dark hover:underline">
                  {row.product.name}
                </Link>
                <div className="text-white/50 text-[12px]">{row.product.size} · {row.product.category}</div>
              </div>
              {row.archived ? <Pill label="Archived" className="bg-red-400/10 text-red-300" /> : <Pill label="Live" className="bg-green-400/10 text-green-300" />}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-[12px]">
              <div><span className="text-white/40">Wholesale</span> <span className="text-white/80">{formatCurrency(row.product.supplierCaseCost)}</span></div>
              <div><span className="text-white/40">SPA</span> <span className={row.spaInvariantViolated ? 'text-red-400 font-bold' : 'text-white/80'}>{formatCurrency(row.effectiveSpaPrice)}</span></div>
              <div><span className="text-white/40">Standard</span> <span className="text-white/80">{formatCurrency(row.effectiveStandardPrice)}</span></div>
              <div><span className="text-white/40">Individual</span> <span className="text-white/80">{row.individualPublicEnabled ? formatCurrency(row.effectiveIndividualPrice) : row.individualStoredInternal ? 'Hidden' : '—'}</span></div>
            </div>
            {rowError?.id === row.product.id && <div className="text-[11px] text-red-400 mt-2">{rowError.message}</div>}
            <div className="flex items-center gap-4 mt-3">
              <button disabled={busyId === row.product.id} onClick={() => handleToggleArchive(row)} className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/70 hover:text-red-300 disabled:opacity-40">
                {row.archived ? 'Reactivate' : 'Archive'}
              </button>
              <Link href={`/admin/inventory/${row.product.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                Edit →
              </Link>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-16 text-white/50">No products match this filter.</div>}
      </div>
    </div>
  )
}
