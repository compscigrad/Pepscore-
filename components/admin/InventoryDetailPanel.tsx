'use client'

// Client component: the manual inventory-entry workflow (6 named actions)
// plus the pricing editor. Every write goes through /api/admin/inventory/
// [id]/actions or /pricing, then router.refresh() re-pulls the server-
// rendered detail page so the ledger/status shown is always the real DB
// state, never optimistic local state drifting from it.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@prisma/client'

interface Props {
  product: Product
  availableUnits: number | null
  completeCasesAvailable: number | null
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

type ActionKey = 'INITIALIZE' | 'ADD_STOCK' | 'REMOVE_STOCK' | 'SET_EXACT_COUNT' | 'DAMAGE_LOSS' | 'REVERSE_LAST' | null

const DESTRUCTIVE_ACTIONS: ActionKey[] = ['REMOVE_STOCK', 'SET_EXACT_COUNT', 'DAMAGE_LOSS']

const ACTION_LABEL: Record<Exclude<ActionKey, null>, string> = {
  INITIALIZE: 'Initialize Inventory',
  ADD_STOCK: 'Add Stock',
  REMOVE_STOCK: 'Remove Stock',
  SET_EXACT_COUNT: 'Set Exact Count',
  DAMAGE_LOSS: 'Record Damage or Loss',
  REVERSE_LAST: 'Reverse Last Adjustment',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-g500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const inputCls = 'w-full rounded-lg border border-g100 px-3 py-2 text-[13px]'

export function InventoryDetailPanel({ product, availableUnits, completeCasesAvailable }: Props) {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState<ActionKey>(null)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [unitsPerCase, setUnitsPerCase] = useState(product.unitsPerCase?.toString() ?? '')
  const [lowStockThreshold, setLowStockThreshold] = useState(product.lowStockThreshold?.toString() ?? '')

  const [supplierCost, setSupplierCost] = useState(product.supplierCaseCost?.toString() ?? '')
  const [activeStandard, setActiveStandard] = useState(product.activeStandardCasePrice?.toString() ?? '')
  const [activeSpa, setActiveSpa] = useState(product.activeSpaCasePrice?.toString() ?? '')
  const [activeBulk, setActiveBulk] = useState(product.activeBulkPrice?.toString() ?? '')
  const [activeIndividual, setActiveIndividual] = useState(product.activeIndividualVialPrice?.toString() ?? '')
  const [individualSalesEnabled, setIndividualSalesEnabled] = useState(product.individualSalesEnabled)
  const [manualOverride, setManualOverride] = useState(product.manualPricingOverride)
  const [overrideReason, setOverrideReason] = useState(product.pricingOverrideReason ?? '')
  const [sku, setSku] = useState(product.sku ?? '')
  const [pricingBusy, setPricingBusy] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  function resetActionForm() {
    setActiveAction(null)
    setQuantity('')
    setReason('')
    setNotes('')
    setConfirmChecked(false)
    setError(null)
  }

  async function runAction() {
    if (!activeAction) return
    const needsConfirm = DESTRUCTIVE_ACTIONS.includes(activeAction)
    if (needsConfirm && !confirmChecked) {
      setError('Please confirm this change before saving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> =
        activeAction === 'REVERSE_LAST' ? { action: activeAction, notes: notes || undefined } : { action: activeAction, quantity: Number(quantity), reason: reason || undefined, notes: notes || undefined }
      await postAction(product.id, body)
      resetActionForm()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function enableTracking() {
    setBusy(true)
    setError(null)
    try {
      await postAction(product.id, { action: 'ENABLE_TRACKING' })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable tracking')
    } finally {
      setBusy(false)
    }
  }

  async function saveThresholds() {
    setBusy(true)
    setError(null)
    try {
      await postAction(product.id, {
        action: 'SET_THRESHOLDS',
        unitsPerCase: unitsPerCase === '' ? null : Number(unitsPerCase),
        lowStockThreshold: lowStockThreshold === '' ? null : Number(lowStockThreshold),
      })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save thresholds')
    } finally {
      setBusy(false)
    }
  }

  async function recalculateSuggested() {
    if (supplierCost === '') return
    setPricingBusy(true)
    setPricingError(null)
    try {
      await patchPricing(product.id, { supplierCaseCost: Number(supplierCost) })
      router.refresh()
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Failed to recalculate')
    } finally {
      setPricingBusy(false)
    }
  }

  async function savePricing() {
    setPricingBusy(true)
    setPricingError(null)
    try {
      await patchPricing(product.id, {
        activeStandardCasePrice: activeStandard === '' ? null : Number(activeStandard),
        activeSpaCasePrice: activeSpa === '' ? null : Number(activeSpa),
        activeBulkPrice: activeBulk === '' ? null : Number(activeBulk),
        activeIndividualVialPrice: activeIndividual === '' ? null : Number(activeIndividual),
        individualSalesEnabled,
        manualPricingOverride: manualOverride,
        pricingOverrideReason: overrideReason || null,
        sku: sku || null,
      })
      router.refresh()
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Failed to save pricing')
    } finally {
      setPricingBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Pricing ─── */}
      <div className="bg-white rounded-2xl shadow-sh p-6">
        <h2 className="font-heading text-[15px] font-bold text-dark mb-4">Pricing</h2>

        <div className="flex gap-2 items-end mb-4">
          <Field label="Supplier Case Cost">
            <input className={inputCls} type="number" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} placeholder="—" />
          </Field>
          <button onClick={recalculateSuggested} disabled={pricingBusy} className="rounded-lg border border-g100 px-3 py-2 text-[12px] font-heading font-bold text-dark hover:bg-g100 whitespace-nowrap">
            Recalculate Suggested
          </button>
        </div>
        <p className="text-[11px] text-g500 -mt-2 mb-4">
          Suggested: Standard {product.suggestedStandardCasePrice ?? '—'} · SPA {product.suggestedSpaCasePrice ?? '—'} · Individual {product.suggestedIndividualVialPrice ?? '—'}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="Active Standard Case">
            <input className={inputCls} type="number" value={activeStandard} onChange={(e) => setActiveStandard(e.target.value)} />
          </Field>
          <Field label="Active SPA Case">
            <input className={inputCls} type="number" value={activeSpa} onChange={(e) => setActiveSpa(e.target.value)} />
          </Field>
          <Field label="Active Bulk">
            <input className={inputCls} type="number" value={activeBulk} onChange={(e) => setActiveBulk(e.target.value)} />
          </Field>
          <Field label="Active Individual Vial">
            <input className={inputCls} type="number" value={activeIndividual} onChange={(e) => setActiveIndividual(e.target.value)} />
          </Field>
        </div>

        {activeIndividual !== '' && !individualSalesEnabled && (
          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">Individual price stored — sales currently disabled</p>
        )}

        <label className="flex items-center gap-2 text-[13px] text-dark mb-2">
          <input type="checkbox" checked={individualSalesEnabled} onChange={(e) => setIndividualSalesEnabled(e.target.checked)} />
          Individual sales enabled
        </label>
        <label className="flex items-center gap-2 text-[13px] text-dark mb-3">
          <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} />
          Manual pricing override
        </label>

        <Field label="Override Reason">
          <input className={inputCls} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why this deviates from the formula" />
        </Field>
        <div className="mt-3">
          <Field label="SKU">
            <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="—" />
          </Field>
        </div>

        {pricingError && <p className="text-[12px] text-red-600 mt-3">{pricingError}</p>}
        <button onClick={savePricing} disabled={pricingBusy} className="mt-4 rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-dark hover:bg-gold-dark">
          Save Pricing
        </button>
      </div>

      {/* ─── Inventory ─── */}
      <div className="bg-white rounded-2xl shadow-sh p-6">
        <h2 className="font-heading text-[15px] font-bold text-dark mb-4">Inventory</h2>

        {!product.inventoryTrackingEnabled ? (
          <div>
            <p className="text-[13px] text-g500 mb-3">Inventory tracking is off for this product.</p>
            <button onClick={enableTracking} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-dark hover:bg-gold-dark">
              Enable Inventory Tracking
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-g500">On Hand</p>
                <p className="text-xl font-heading font-bold text-dark">{product.physicalStockOnHand ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-g500">Reserved</p>
                <p className="text-xl font-heading font-bold text-dark">{product.reservedUnits}</p>
              </div>
              <div>
                <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-g500">Available</p>
                <p className="text-xl font-heading font-bold text-dark">{availableUnits ?? '—'}</p>
              </div>
            </div>
            <p className="text-[12px] text-g500 mb-4">Complete cases available: {completeCasesAvailable ?? '—'}</p>

            <div className="flex gap-2 items-end mb-4">
              <Field label="Units Per Case">
                <input className={inputCls} type="number" value={unitsPerCase} onChange={(e) => setUnitsPerCase(e.target.value)} />
              </Field>
              <Field label="Low-Stock Threshold">
                <input className={inputCls} type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
              </Field>
              <button onClick={saveThresholds} disabled={busy} className="rounded-lg border border-g100 px-3 py-2 text-[12px] font-heading font-bold text-dark hover:bg-g100 whitespace-nowrap">
                Save
              </button>
            </div>

            {product.physicalStockOnHand === null ? (
              <button
                onClick={() => setActiveAction('INITIALIZE')}
                className="rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-dark hover:bg-gold-dark"
              >
                Initialize Inventory
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(['ADD_STOCK', 'REMOVE_STOCK', 'SET_EXACT_COUNT', 'DAMAGE_LOSS', 'REVERSE_LAST'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveAction(key)}
                    className="rounded-lg border border-g100 px-3 py-2 text-[12px] font-heading font-bold text-dark hover:bg-g100"
                  >
                    {ACTION_LABEL[key]}
                  </button>
                ))}
              </div>
            )}

            {activeAction && (
              <div className="mt-4 border border-g100 rounded-xl p-4">
                <p className="font-heading text-[13px] font-bold text-dark mb-3">{ACTION_LABEL[activeAction]}</p>
                {activeAction !== 'REVERSE_LAST' && (
                  <Field label={activeAction === 'SET_EXACT_COUNT' ? 'New Exact Count' : 'Quantity'}>
                    <input className={inputCls} type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </Field>
                )}
                {activeAction !== 'REVERSE_LAST' && (
                  <div className="mt-2">
                    <Field label="Reason (optional)">
                      <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                  </div>
                )}
                <div className="mt-2">
                  <Field label="Notes (optional)">
                    <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                </div>

                {DESTRUCTIVE_ACTIONS.includes(activeAction) && (
                  <label className="flex items-center gap-2 text-[12px] text-dark mt-3">
                    <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                    I confirm this change is correct.
                  </label>
                )}

                {error && <p className="text-[12px] text-red-600 mt-3">{error}</p>}

                <div className="flex gap-2 mt-4">
                  <button onClick={runAction} disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-[13px] font-heading font-bold text-dark hover:bg-gold-dark">
                    Save
                  </button>
                  <button onClick={resetActionForm} className="rounded-lg border border-g100 px-4 py-2 text-[13px] font-heading font-bold text-dark hover:bg-g100">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
