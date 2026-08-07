'use client'

// The "Correct Sell Unit" admin action -- an explicit discrepancy
// correction for a saved invoice line item, distinct from ordinary
// editing. Shows the full before/after picture (product, current vs
// proposed sell unit, recalculated vial consumption, reservation delta,
// any shortage or affected backorder) before the admin can save, and
// defaults to preserving the historical price -- recalculating pricing is
// an explicit, separately-confirmed opt-in.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AvailableSellUnitOption } from '@/lib/pricing/sellUnits'
import { card, input, label as labelCls, pillPrimary, pillOutline } from './theme'

interface Props {
  invoiceId: string
  itemId: string
  onClose: () => void
}

interface CorrectionData {
  item: {
    id: string
    name: string
    quantity: number
    unitPrice: number
    total: number
    sellUnit: string | null
    unitsPerSellUnit: number | null
    inventoryQuantityConsumed: number | null
  }
  product: {
    id: string
    name: string
    size: string
    individualSalesEnabled: boolean
    activeStandardCasePrice: number | null
    activeSpaCasePrice: number | null
    activeBulkPrice: number | null
    activeIndividualVialPrice: number | null
    unitsPerCase: number | null
  }
  availableSellUnits: AvailableSellUnitOption[]
  reservation: { id: string; quantity: number; status: 'ACTIVE' | 'RELEASED' | 'FULFILLED' } | null
  backorder: { id: string; vialsBackordered: number | null } | null
}

const SELL_UNIT_LABEL: Record<string, string> = {
  CASE_STANDARD: 'Standard Case',
  CASE_SPA: 'SPA Case',
  CASE_BULK: 'Bulk',
  INDIVIDUAL_VIAL: 'Individual Vial',
}

function priceForSellUnit(product: CorrectionData['product'], sellUnit: string): number | null {
  if (sellUnit === 'CASE_STANDARD') return product.activeStandardCasePrice
  if (sellUnit === 'CASE_SPA') return product.activeSpaCasePrice
  if (sellUnit === 'CASE_BULK') return product.activeBulkPrice
  if (sellUnit === 'INDIVIDUAL_VIAL') return product.activeIndividualVialPrice
  return null
}

export function SellUnitCorrectionDialog({ invoiceId, itemId, onClose }: Props) {
  const router = useRouter()
  const [data, setData] = useState<CorrectionData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [proposedSellUnit, setProposedSellUnit] = useState<string>('')
  const [individualOverride, setIndividualOverride] = useState(false)
  const [priceBehavior, setPriceBehavior] = useState<'INVENTORY_ONLY' | 'RECALCULATE_PRICING'>('INVENTORY_ONLY')
  const [newUnitPrice, setNewUnitPrice] = useState('')
  const [reason, setReason] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/invoices/${invoiceId}/items/${itemId}/correct-sell-unit`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load correction data')
        return res.json()
      })
      .then((d: CorrectionData) => {
        setData(d)
        setProposedSellUnit(d.item.sellUnit ?? d.availableSellUnits[0]?.sellUnit ?? '')
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load correction data'))
  }, [invoiceId, itemId])

  if (loadError) {
    return (
      <Modal onClose={onClose}>
        <p className="text-red-400 text-sm">{loadError}</p>
      </Modal>
    )
  }
  if (!data) {
    return (
      <Modal onClose={onClose}>
        <p className="text-white/60 text-sm">Loading…</p>
      </Modal>
    )
  }

  // Sell units the product is actually configured for, plus -- only when
  // the admin has explicitly checked the override -- Individual Vial for a
  // product where individual sales are disabled (the Tesamorelin case).
  // The override never enables real individual sales; it only allows this
  // one historical-line correction to be recorded.
  const selectableOptions: { sellUnit: string; unitsPerSellUnit: number; price: number | null }[] = [
    ...data.availableSellUnits.map((o) => ({ sellUnit: o.sellUnit, unitsPerSellUnit: o.unitsPerSellUnit, price: o.price })),
  ]
  const individualAlreadyListed = selectableOptions.some((o) => o.sellUnit === 'INDIVIDUAL_VIAL')
  if (!individualAlreadyListed && individualOverride && data.product.activeIndividualVialPrice !== null) {
    selectableOptions.push({ sellUnit: 'INDIVIDUAL_VIAL', unitsPerSellUnit: 1, price: data.product.activeIndividualVialPrice })
  }

  const selectedOption = selectableOptions.find((o) => o.sellUnit === proposedSellUnit)
  const proposedUnitsPerSellUnit = selectedOption?.unitsPerSellUnit ?? data.product.unitsPerCase ?? 1
  const proposedInventoryConsumed = data.item.quantity * proposedUnitsPerSellUnit
  const currentConsumed = data.item.inventoryQuantityConsumed ?? 0
  const currentReservedQty = data.reservation?.quantity ?? 0
  const delta = proposedInventoryConsumed - currentReservedQty
  const suggestedPrice = priceForSellUnit(data.product, proposedSellUnit)
  const isFulfilled = data.reservation?.status === 'FULFILLED'

  async function submit() {
    if (!reason.trim()) {
      setError('A correction reason is required.')
      return
    }
    if (!confirmChecked) {
      setError('Please confirm this correction before saving.')
      return
    }
    if (priceBehavior === 'RECALCULATE_PRICING' && newUnitPrice === '') {
      setError('Enter the recalculated unit price.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/items/${itemId}/correct-sell-unit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellUnit: proposedSellUnit,
          unitsPerSellUnit: proposedUnitsPerSellUnit,
          individualSalesOverride: individualOverride,
          priceBehavior,
          newUnitPrice: priceBehavior === 'RECALCULATE_PRICING' ? Number(newUnitPrice) : undefined,
          reason,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Correction failed')
      }
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Correction failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="font-heading text-lg font-bold text-white mb-1">Correct Sell Unit</h2>
      <p className="text-white/50 text-xs mb-4">
        {data.product.name} {data.product.size} — line: {data.item.name}
      </p>

      {isFulfilled && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-3 mb-4">
          <p className="text-amber-300 text-[12px] font-bold uppercase tracking-wide mb-1">Higher risk: already fulfilled</p>
          <p className="text-white/70 text-[12px]">
            This line&apos;s physical stock deduction will be reversed and reapplied at the corrected quantity. Shipment records are never duplicated or altered.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4 text-[13px]">
        <div>
          <p className="text-white/40 text-[11px] uppercase tracking-wide mb-1">Current</p>
          <p className="text-white">Sell unit: {data.item.sellUnit ? SELL_UNIT_LABEL[data.item.sellUnit] : '—'}</p>
          <p className="text-white">Units per sell unit: {data.item.unitsPerSellUnit ?? '—'}</p>
          <p className="text-white">Invoice quantity: {data.item.quantity}</p>
          <p className="text-white">Inventory consumed: {currentConsumed} vial(s)</p>
          <p className="text-white">
            Reservation: {data.reservation ? `${data.reservation.quantity} vial(s) — ${data.reservation.status}` : 'none'}
          </p>
          {data.backorder && <p className="text-red-300">Affected backorder: {data.backorder.vialsBackordered ?? '—'} vial(s)</p>}
        </div>
        <div>
          <p className="text-white/40 text-[11px] uppercase tracking-wide mb-1">Proposed</p>
          <label className={labelCls}>Sell unit</label>
          <select className={input} value={proposedSellUnit} onChange={(e) => setProposedSellUnit(e.target.value)}>
            {selectableOptions.map((o) => (
              <option key={o.sellUnit} value={o.sellUnit} className="bg-white text-dark">
                {SELL_UNIT_LABEL[o.sellUnit]}
              </option>
            ))}
          </select>
          {!data.product.individualSalesEnabled && !individualAlreadyListed && (
            <label className="flex items-center gap-2 text-[12px] text-white/70 mt-2">
              <input type="checkbox" checked={individualOverride} onChange={(e) => setIndividualOverride(e.target.checked)} />
              Override: allow Individual Vial for this historical line (individual sales are otherwise disabled for this product)
            </label>
          )}
          <p className="text-white mt-2">Units per sell unit: {proposedUnitsPerSellUnit}</p>
          <p className="text-white">Recalculated inventory consumption: {proposedInventoryConsumed} vial(s)</p>
          <p className={delta === 0 ? 'text-white/60' : delta > 0 ? 'text-amber-300' : 'text-blue-300'}>
            Reservation delta: {delta > 0 ? '+' : ''}
            {delta} vial(s)
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className={labelCls}>Pricing behavior</p>
        <label className="flex items-start gap-2 text-[13px] text-white mb-2">
          <input type="radio" checked={priceBehavior === 'INVENTORY_ONLY'} onChange={() => setPriceBehavior('INVENTORY_ONLY')} className="mt-1" />
          <span>
            <strong>Correct inventory interpretation only</strong> — keeps the invoice price (${data.item.unitPrice}) and line total unchanged.
          </span>
        </label>
        <label className="flex items-start gap-2 text-[13px] text-white">
          <input type="radio" checked={priceBehavior === 'RECALCULATE_PRICING'} onChange={() => setPriceBehavior('RECALCULATE_PRICING')} className="mt-1" />
          <span>
            <strong>Correct sell unit and recalculate pricing</strong> — uses the approved pricing tier and records a formal invoice revision.
          </span>
        </label>
        {priceBehavior === 'RECALCULATE_PRICING' && (
          <div className="mt-2 ml-6">
            <p className="text-white/60 text-[12px] mb-1">
              Old price: ${data.item.unitPrice} {suggestedPrice !== null && <>· Suggested new price: ${suggestedPrice}</>}
            </p>
            <input
              className={input}
              type="number"
              min={0}
              step="0.01"
              placeholder="New unit price"
              value={newUnitPrice}
              onChange={(e) => setNewUnitPrice(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className={labelCls}>Reason (required)</label>
        <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this line's sell unit is being corrected" />
      </div>

      <label className="flex items-center gap-2 text-[12px] text-white/70 mb-4">
        <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
        I confirm this correction is accurate and should be saved.
      </label>

      {error && <p className="text-red-400 text-[12px] mb-3">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className={pillPrimary}>
          Save Correction
        </button>
        <button onClick={onClose} className={pillOutline}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className={`${card} max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
