'use client'

// Admin -> Catalog -> Product Master: the one "see every product and every
// pricing/status field in one place" view (2026-08-12 admin optimization
// sprint; master price-table columns + Single Vial terminology added
// 2026-08-13). Reads from lib/adminProductMaster.ts (itself built on the
// same listInventoryOverview() the existing Inventory page uses -- no
// second catalog query, no second pricing screen). Every write here goes
// through the same two routes the existing Inventory detail page already
// uses (/pricing for pricingStatus/individualSalesEnabled, /actions for
// backorderEnabled), then router.refresh() -- no new API surface. Full
// field-by-field editing stays on the existing /admin/inventory/[id]
// detail page; this view links there rather than re-implementing that editor.
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ProductMasterRow, PricingSourceStatus } from '@/lib/adminProductMaster'
import { PRICING_SOURCE_LABEL } from '@/lib/adminProductMaster'

// Compact whole-dollar display when the authoritative price has no cents,
// full cents when it does (spec #9) -- applied to every price column here.
function money(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? `$${n.toLocaleString('en-US')}` : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

// Sticky identity-column background -- solid (not translucent) so scrolled
// content never bleeds through underneath the frozen columns.
const STICKY_CELL = 'sticky z-10 bg-[#121212]'

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

// Labels use the current "Single Vial"/"Singles" terminology (2026-08-13);
// the FilterKey identifiers themselves are internal and unchanged.
const FILTER_LABEL: Record<FilterKey, string> = {
  ALL: 'All',
  LIVE: 'Live',
  ARCHIVED: 'Archived',
  CASE_ENABLED: 'Case Enabled',
  INDIVIDUAL_ENABLED: 'Singles Enabled',
  INDIVIDUAL_HIDDEN: 'Singles Hidden',
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

type SortKey = 'NAME' | 'CATEGORY' | 'STATUS' | 'COST' | 'STANDARD' | 'SPA' | 'SINGLE_VIAL' | 'INVENTORY' | 'UPDATED'

// NAME first and default (spec #1: alphabetical Product Name A-Z by default).
const SORT_LABEL: Record<SortKey, string> = {
  NAME: 'Name',
  CATEGORY: 'Category',
  STATUS: 'Active / Archived',
  COST: 'Cost',
  STANDARD: 'Storefront Case',
  SPA: 'SPA Price',
  SINGLE_VIAL: 'Single Vial Price',
  INVENTORY: 'Inventory',
  UPDATED: 'Last Updated',
}

function sortValue(row: ProductMasterRow, key: SortKey): string | number {
  switch (key) {
    case 'NAME': return row.product.name.toLowerCase()
    case 'CATEGORY': return row.product.category.toLowerCase()
    case 'STATUS': return row.archived ? 1 : 0
    case 'COST': return row.product.supplierCaseCost ?? -1
    case 'STANDARD': return row.effectiveStandardPrice ?? -1
    case 'SPA': return row.effectiveSpaPrice ?? -1
    case 'SINGLE_VIAL': return row.singleVialPrice ?? -1
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
    // Default sort stays alphabetical by Product Name (spec #1) unless the
    // admin explicitly picks something else -- archived rows are never
    // excluded here, only by the ARCHIVED/LIVE filter (spec: "Archived
    // products should remain visible in the full master list unless
    // filtered out").
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

  async function handleToggleSingles(row: ProductMasterRow) {
    const willEnable = !row.individualPublicEnabled
    if (willEnable) {
      // Client-side pre-check for instant feedback (spec #12: "block public
      // activation and explain why") -- the server enforces the same
      // invariant authoritatively (SinglesRequiresPriceError in
      // lib/pricing/service.ts), so this is a UX nicety, not the real
      // boundary; a stale client state still gets the same rejection back
      // from the API if this check were somehow bypassed.
      if (row.singleVialPrice === null) {
        setRowError({ id: row.product.id, message: `Cannot enable public Single Vial sales -- no valid Single Vial price is set for "${row.product.name}" (${row.product.size}) yet. Set a price first.` })
        return
      }
      const message = `Make Single Vial sales PUBLIC for "${row.product.name}" (${row.product.size})? It will immediately become purchasable by the vial on the storefront at the currently stored price of ${money(row.singleVialPrice)}.`
      if (!window.confirm(message)) return
    }
    setBusyId(row.product.id)
    setRowError(null)
    try {
      await patchPricing(row.product.id, { individualSalesEnabled: willEnable, reason: `Toggled from Product Master (single vial ${willEnable ? 'enabled' : 'hidden'})` })
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
          <p className="text-[12px] text-white/50 mt-0.5">{filtered.length} of {rows.length} shown · Cost &amp; SPA visible to admin only</p>
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

      {/* Desktop master price table -- required column order (spec #4):
          Archive | Singles | Product | Cost | Storefront Case | SPA |
          Single Vial | 5% | 8% | 10% | 15%, then secondary operational
          columns. Archive/Singles/Product are sticky so they stay visible
          while scrolling through the pricing columns on a narrower desktop
          window (spec #22). */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-[13px] border-separate border-spacing-0">
          <thead>
            <tr className="border-b border-white/10">
              <th className={`${STICKY_CELL} left-0 text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-3 py-3 whitespace-nowrap border-b border-white/10`}>Archive</th>
              <th className={`${STICKY_CELL} left-[76px] text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-3 py-3 whitespace-nowrap border-b border-white/10`}>Singles</th>
              <th className={`${STICKY_CELL} left-[152px] text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-3 py-3 whitespace-nowrap border-b border-white/10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]`}>Product</th>
              {['Cost', 'Storefront Case', 'SPA', 'Single Vial', '5%', '8%', '10%', '15%', 'Category', 'Source', 'Backorder', 'Image', 'Inventory', 'Updated', ''].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-3 py-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.product.id} className="border-b border-white/10 hover:bg-white/[0.02] align-top group">
                {/* Archive */}
                <td className={`${STICKY_CELL} left-0 px-3 py-3 border-b border-white/10 group-hover:bg-[#161616]`}>
                  <input
                    type="checkbox"
                    checked={row.archived}
                    disabled={busyId === row.product.id}
                    onChange={() => handleToggleArchive(row)}
                    aria-label={row.archived ? `Reactivate ${row.product.name}` : `Archive ${row.product.name}`}
                    className="w-4 h-4 accent-red-400 cursor-pointer disabled:opacity-40"
                  />
                </td>
                {/* Singles */}
                <td className={`${STICKY_CELL} left-[76px] px-3 py-3 border-b border-white/10 group-hover:bg-[#161616]`}>
                  <input
                    type="checkbox"
                    checked={row.individualPublicEnabled}
                    disabled={busyId === row.product.id}
                    onChange={() => handleToggleSingles(row)}
                    aria-label={row.individualPublicEnabled ? `Disable public Single Vial sales for ${row.product.name}` : `Enable public Single Vial sales for ${row.product.name}`}
                    className="w-4 h-4 accent-gold cursor-pointer disabled:opacity-40"
                    title={row.individualStoredInternal ? 'Single Vial price stored, not currently public' : undefined}
                  />
                </td>
                {/* Product */}
                <td className={`${STICKY_CELL} left-[152px] px-3 py-3 border-b border-white/10 group-hover:bg-[#161616] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]`}>
                  <Link href={`/admin/inventory/${row.product.id}`} className="font-semibold text-white hover:text-gold-dark hover:underline whitespace-nowrap">
                    {row.product.name} — {row.product.size}
                  </Link>
                  <div className="text-white/50 text-[12px] whitespace-nowrap">{row.product.sku ?? 'no SKU'}</div>
                  {rowError?.id === row.product.id && <div className="text-[11px] text-red-400 mt-1 max-w-[220px] whitespace-normal">{rowError.message}</div>}
                </td>
                {/* Cost -- admin-only, never exposed publicly */}
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{money(row.product.supplierCaseCost)}</td>
                {/* Storefront Case -- with actual units-per-case, never assumed */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {money(row.effectiveStandardPrice)}
                  {row.product.unitsPerCase !== null && <div className="text-[10px] text-white/40">{row.product.unitsPerCase}/case</div>}
                </td>
                {/* SPA -- admin-only */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={row.spaInvariantViolated ? 'text-red-400 font-bold' : ''}>{money(row.effectiveSpaPrice)}</span>
                  {row.spaInvariantViolated && <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide">SPA ≥ Standard</div>}
                </td>
                {/* Single Vial -- shown regardless of Singles state */}
                <td className="px-3 py-3 whitespace-nowrap">
                  {row.singleVialPrice !== null ? money(row.singleVialPrice) : <span className="text-[11px] text-amber-300/80 italic">Needs Price</span>}
                  {row.singleVialPrice !== null && !row.individualPublicEnabled && <div className="text-[10px] text-white/40">hidden</div>}
                </td>
                {/* Bulk tiers -- always derived from Storefront Case, never SPA, never independently editable */}
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{money(row.bulkTiers.five)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{money(row.bulkTiers.eight)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{money(row.bulkTiers.ten)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-white/70">{money(row.bulkTiers.fifteen)}</td>
                {/* Secondary operational columns */}
                <td className="px-3 py-3 text-white/60 whitespace-nowrap">{row.product.category}</td>
                <td className="px-3 py-3">
                  <Pill label={PRICING_SOURCE_LABEL[row.pricingSourceStatus]} className={PRICING_SOURCE_STYLE[row.pricingSourceStatus]} />
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

      {/* Compact card layout below lg -- expandable-row equivalent for
          tablet/phone (spec #23): identity + Archive/Singles controls up
          top (safe from accidental taps, each still confirm-gated), full
          pricing including bulk tiers below. */}
      <div className="lg:hidden divide-y divide-white/10">
        {filtered.map((row) => (
          <div key={row.product.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link href={`/admin/inventory/${row.product.id}`} className="font-semibold text-white hover:text-gold-dark hover:underline">
                  {row.product.name} — {row.product.size}
                </Link>
                <div className="text-white/50 text-[12px]">{row.product.category}</div>
              </div>
              {row.archived ? <Pill label="Archived" className="bg-red-400/10 text-red-300" /> : <Pill label="Live" className="bg-green-400/10 text-green-300" />}
            </div>

            <div className="flex items-center gap-5 mt-3 text-[12px]">
              <label className="flex items-center gap-1.5 text-white/70">
                <input type="checkbox" checked={row.archived} disabled={busyId === row.product.id} onChange={() => handleToggleArchive(row)} className="w-4 h-4 accent-red-400 disabled:opacity-40" />
                Archive
              </label>
              <label className="flex items-center gap-1.5 text-white/70">
                <input type="checkbox" checked={row.individualPublicEnabled} disabled={busyId === row.product.id} onChange={() => handleToggleSingles(row)} className="w-4 h-4 accent-gold disabled:opacity-40" />
                Singles
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-[12px]">
              <div><span className="text-white/40">Cost</span> <span className="text-white/80">{money(row.product.supplierCaseCost)}</span></div>
              <div><span className="text-white/40">Storefront Case</span> <span className="text-white/80">{money(row.effectiveStandardPrice)}</span></div>
              <div><span className="text-white/40">SPA</span> <span className={row.spaInvariantViolated ? 'text-red-400 font-bold' : 'text-white/80'}>{money(row.effectiveSpaPrice)}</span></div>
              <div><span className="text-white/40">Single Vial</span> <span className="text-white/80">{row.singleVialPrice !== null ? money(row.singleVialPrice) : 'Needs Price'}</span></div>
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              Bulk: 5% {money(row.bulkTiers.five)} · 8% {money(row.bulkTiers.eight)} · 10% {money(row.bulkTiers.ten)} · 15% {money(row.bulkTiers.fifteen)}
            </p>

            {rowError?.id === row.product.id && <div className="text-[11px] text-red-400 mt-2">{rowError.message}</div>}
            <div className="flex items-center gap-4 mt-3">
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
