export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { isAdminClerkUser } from '@/lib/isAdmin'
import { getInventoryDetail } from '@/lib/adminInventory'
import { InventoryDetailPanel } from '@/components/admin/InventoryDetailPanel'
import { ProductContentSection } from '@/components/admin/ProductContentSection'

interface Props {
  params: Promise<{ id: string }>
}

const EVENT_LABEL: Record<string, string> = {
  INITIALIZE: 'Initialized',
  RESTOCK: 'Restock',
  MANUAL_INCREASE: 'Manual Increase',
  MANUAL_DECREASE: 'Manual Decrease',
  DAMAGE_LOSS: 'Damage / Loss',
  RECONCILIATION: 'Reconciliation',
  RESERVATION: 'Reserved',
  RESERVATION_RELEASE: 'Reservation Released',
  FULFILLMENT_DEDUCTION: 'Fulfillment Deduction',
  BACKORDER_ALLOCATION: 'Backorder Allocation',
  REVERSAL: 'Reversal',
}

const SELL_UNIT_LABEL: Record<string, string> = {
  STANDARD_CASE: 'Standard Case',
  SPA_CASE: 'SPA Case',
  BULK: 'Bulk',
  INDIVIDUAL_VIAL: 'Individual Vial',
}

const PRICE_SOURCE_LABEL: Record<string, string> = {
  ADMIN_PRICING_PAGE: 'Admin Pricing Page',
  INVOICE_LINE_UPDATE_PRODUCT_PRICE: 'Invoice Line — Update Product Price',
  CATALOG_SEED: 'Catalog Seed',
}

function formatPrice(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`
}

export default async function AdminInventoryDetailPage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/inventory')
  if (!isAdminClerkUser(userId)) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const { id } = await params
  const detail = await getInventoryDetail(id)
  if (!detail) notFound()

  const { product, availableUnits, completeCasesAvailable, backorderedVials, ledgerEntries, reservations, alerts, priceChanges } = detail

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">
              {product.name} <span className="text-white/50 font-normal">{product.size}</span>
            </h1>
            <p className="text-white/50 text-sm mt-0.5">{product.sku ?? 'No SKU'} · {backorderedVials > 0 ? `${backorderedVials} vial(s) backordered` : 'No active backorders'}</p>
          </div>
          <Link href="/admin/inventory" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
            ← Inventory
          </Link>
        </div>

        <div className="mb-6">
          <InventoryDetailPanel product={product} availableUnits={availableUnits} completeCasesAvailable={completeCasesAvailable} />
        </div>

        <div className="mb-6">
          <ProductContentSection productId={product.id} />
        </div>

        {reservations.length > 0 && (
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6 mb-6">
            <h2 className="font-heading text-[15px] font-bold text-white mb-3">Active Reservations</h2>
            <ul className="text-[13px] text-white space-y-1">
              {reservations.map((r) => (
                <li key={r.id}>
                  {r.quantity} vial(s) — reserved {new Date(r.reservedAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-6 mb-6">
            <h2 className="font-heading text-[15px] font-bold text-white mb-3">Low-Stock Alert History</h2>
            <ul className="text-[13px] text-white space-y-1">
              {alerts.map((a) => (
                <li key={a.id}>
                  {a.status === 'OPEN' ? (
                    <span className="text-red-400 font-bold">OPEN</span>
                  ) : (
                    <span className="text-green-400 font-bold">RESOLVED</span>
                  )}{' '}
                  — threshold {a.threshold}, available at alert {a.availableAtAlert} ({new Date(a.createdAt).toLocaleString()})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden mb-6">
          <div className="p-6 border-b border-white/10">
            <h2 className="font-heading text-[15px] font-bold text-white">Price Change History</h2>
            <p className="text-[12px] text-white/50 mt-0.5">Most recent {priceChanges.length} authoritative price changes</p>
          </div>
          {priceChanges.length === 0 ? (
            <div className="text-center py-12 text-white/50 text-[13px]">No price changes recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {['When', 'Sell Unit', 'Previous', 'New', 'Source', 'Reason'].map((h) => (
                      <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceChanges.map((change) => (
                    <tr key={change.id} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{new Date(change.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{SELL_UNIT_LABEL[change.sellUnit] ?? change.sellUnit}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{formatPrice(change.previousPrice)}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap">{formatPrice(change.newPrice)}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{PRICE_SOURCE_LABEL[change.source] ?? change.source}</td>
                      <td className="px-4 py-3 text-white/50 max-w-[280px] truncate">{change.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <h2 className="font-heading text-[15px] font-bold text-white">Inventory Ledger</h2>
            <p className="text-[12px] text-white/50 mt-0.5">Most recent {ledgerEntries.length} events</p>
          </div>
          {ledgerEntries.length === 0 ? (
            <div className="text-center py-12 text-white/50 text-[13px]">No inventory events yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {['When', 'Event', 'Delta', 'Balance', 'Actor', 'Reason / Notes'].map((h) => (
                      <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">{EVENT_LABEL[entry.eventType] ?? entry.eventType}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={entry.quantityDelta > 0 ? 'text-green-400 font-bold' : entry.quantityDelta < 0 ? 'text-red-400 font-bold' : 'text-white/50'}>
                          {entry.quantityDelta > 0 ? '+' : ''}{entry.quantityDelta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{entry.previousBalance} → {entry.resultingBalance}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{entry.actor}</td>
                      <td className="px-4 py-3 text-white/50 max-w-[280px] truncate">{entry.reason ?? entry.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
