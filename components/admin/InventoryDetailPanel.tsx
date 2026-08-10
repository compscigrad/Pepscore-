'use client'

// Client component: the manual inventory-entry workflow (6 named actions)
// plus the pricing editor. Every write goes through /api/admin/inventory/
// [id]/actions or /pricing, then router.refresh() re-pulls the server-
// rendered detail page so the ledger/status shown is always the real DB
// state, never optimistic local state drifting from it.
//
// Dark PepScore Lab admin theme (2026-08-07 admin brand migration) --
// reuses components/invoices/theme.ts's tokens rather than reinventing a
// second dark palette.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@prisma/client'
import { card, input as inputCls, label as labelClass, mutedText, pillPrimary, pillOutline, sectionHeading } from '@/components/invoices/theme'
import { computeTierDiffs, type TierDiff } from '@/lib/pricing/history'
import { SELL_UNIT_LABEL } from '@/lib/pricing/labels'

function formatPrice(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}`
}

function formatDifference(previous: number | null, next: number | null): string {
  if (previous === null && next !== null) return 'New price'
  if (previous !== null && next === null) return 'Removed'
  if (previous === null || next === null) return '—'
  const delta = next - previous
  if (delta === 0) return '—'
  return `${delta > 0 ? '+' : '−'}$${Math.abs(delta).toFixed(2)}`
}

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
      <span className={labelClass}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

const smallBtn = 'rounded-lg border border-white/10 px-3 py-2 text-[12px] font-heading font-bold text-white/80 hover:bg-white/5 whitespace-nowrap transition-colors disabled:opacity-50'

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
  const [backorderEnabled, setBackorderEnabled] = useState(product.backorderEnabled)
  const [backorderBusy, setBackorderBusy] = useState(false)

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
  // Phase 3B item 4: a price update showing at least one changed tier is
  // never committed directly -- it's held here for the admin to review
  // (product/strength/sell unit/existing price/new price/difference/public
  // visibility/effect on future transactions) before an explicit Confirm.
  // Non-price-only changes (SKU, override reason, etc. with zero tier
  // deltas) skip the preview and save immediately, matching this component's
  // existing behavior for every other section on this page.
  const [pricingPreview, setPricingPreview] = useState<TierDiff[] | null>(null)
  const [pendingPricingPayload, setPendingPricingPayload] = useState<Record<string, unknown> | null>(null)

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

  async function toggleBackorderEnabled(next: boolean) {
    setBackorderEnabled(next)
    setBackorderBusy(true)
    setError(null)
    try {
      await postAction(product.id, { action: 'SET_BACKORDER_ENABLED', backorderEnabled: next })
      router.refresh()
    } catch (e) {
      setBackorderEnabled(!next)
      setError(e instanceof Error ? e.message : 'Failed to update backorder setting')
    } finally {
      setBackorderBusy(false)
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

  function buildPricingPayload(): Record<string, unknown> {
    return {
      activeStandardCasePrice: activeStandard === '' ? null : Number(activeStandard),
      activeSpaCasePrice: activeSpa === '' ? null : Number(activeSpa),
      activeBulkPrice: activeBulk === '' ? null : Number(activeBulk),
      activeIndividualVialPrice: activeIndividual === '' ? null : Number(activeIndividual),
      individualSalesEnabled,
      manualPricingOverride: manualOverride,
      pricingOverrideReason: overrideReason || null,
      sku: sku || null,
    }
  }

  async function commitPricing(payload: Record<string, unknown>) {
    setPricingBusy(true)
    setPricingError(null)
    try {
      await patchPricing(product.id, payload)
      setPricingPreview(null)
      setPendingPricingPayload(null)
      router.refresh()
    } catch (e) {
      setPricingError(e instanceof Error ? e.message : 'Failed to save pricing')
    } finally {
      setPricingBusy(false)
    }
  }

  // Entry point for the "Save Pricing" button -- diffs the four price tiers
  // against the current product prop and only shows the preview when at
  // least one tier actually changed; a pure non-price edit (SKU, override
  // reason) saves immediately, same as before this feature.
  function requestSavePricing() {
    const payload = buildPricingPayload()
    const diffs = computeTierDiffs(product, {
      ...product,
      activeStandardCasePrice: payload.activeStandardCasePrice as number | null,
      activeSpaCasePrice: payload.activeSpaCasePrice as number | null,
      activeBulkPrice: payload.activeBulkPrice as number | null,
      activeIndividualVialPrice: payload.activeIndividualVialPrice as number | null,
    })
    if (diffs.length === 0) {
      commitPricing(payload)
      return
    }
    setPricingPreview(diffs)
    setPendingPricingPayload(payload)
  }

  function confirmSavePricing() {
    if (!pendingPricingPayload) return
    commitPricing(pendingPricingPayload)
  }

  function cancelPricingPreview() {
    setPricingPreview(null)
    setPendingPricingPayload(null)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Pricing ─── */}
      <div className={`${card} p-6`}>
        <h2 className={`${sectionHeading} mb-4`}>Pricing</h2>

        <div className="flex gap-2 items-end mb-4">
          <Field label="Supplier Case Cost">
            <input className={inputCls} type="number" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} placeholder="—" />
          </Field>
          <button onClick={recalculateSuggested} disabled={pricingBusy} className={smallBtn}>
            Recalculate Suggested
          </button>
        </div>
        <p className={`text-[11px] ${mutedText} -mt-2 mb-4`}>
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
          <p className="text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-lg px-3 py-2 mb-3">Individual price stored — sales currently disabled</p>
        )}

        <label className="flex items-center gap-2 text-[13px] text-white mb-2">
          <input type="checkbox" checked={individualSalesEnabled} onChange={(e) => setIndividualSalesEnabled(e.target.checked)} />
          Individual sales enabled
        </label>
        <label className="flex items-center gap-2 text-[13px] text-white mb-3">
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

        {pricingError && <p className="text-[12px] text-red-400 mt-3">{pricingError}</p>}
        <button onClick={requestSavePricing} disabled={pricingBusy} className={`${pillPrimary} mt-4 px-4 py-2`}>
          Save Pricing
        </button>
      </div>

      {/* ─── Inventory ─── */}
      <div className={`${card} p-6`}>
        <h2 className={`${sectionHeading} mb-4`}>Inventory</h2>

        {/* Catalog-level backorder configuration -- distinct from any
            specific invoice's BackorderCondition. Explicit per
            product/strength, admin-editable with no code deployment.
            See lib/storefront/availability.ts. */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[13px] font-heading font-bold text-white">Allow Backorders</span>
              <span className={`block text-[11px] ${mutedText} mt-0.5`}>
                When available inventory reaches zero, this product/strength stays orderable via the backorder workflow instead of showing Out of Stock.
              </span>
            </span>
            <input
              type="checkbox"
              checked={backorderEnabled}
              disabled={backorderBusy}
              onChange={(e) => toggleBackorderEnabled(e.target.checked)}
              className="w-5 h-5 shrink-0 accent-gold"
              aria-label="Allow backorders for this product"
            />
          </label>
        </div>

        {!product.inventoryTrackingEnabled ? (
          <div>
            <p className={`text-[13px] ${mutedText} mb-3`}>Inventory tracking is off for this product.</p>
            <button onClick={enableTracking} disabled={busy} className={`${pillPrimary} px-4 py-2`}>
              Enable Inventory Tracking
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className={labelClass}>On Hand</p>
                <p className="text-xl font-heading font-bold text-white">{product.physicalStockOnHand ?? '—'}</p>
              </div>
              <div>
                <p className={labelClass}>Reserved</p>
                <p className="text-xl font-heading font-bold text-white">{product.reservedUnits}</p>
              </div>
              <div>
                <p className={labelClass}>Available</p>
                <p className="text-xl font-heading font-bold text-white">{availableUnits ?? '—'}</p>
              </div>
            </div>
            <p className={`text-[12px] ${mutedText} mb-4`}>Complete cases available: {completeCasesAvailable ?? '—'}</p>

            <div className="flex gap-2 items-end mb-4">
              <Field label="Units Per Case">
                <input className={inputCls} type="number" value={unitsPerCase} onChange={(e) => setUnitsPerCase(e.target.value)} />
              </Field>
              <Field label="Low-Stock Threshold">
                <input className={inputCls} type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
              </Field>
              <button onClick={saveThresholds} disabled={busy} className={smallBtn}>
                Save
              </button>
            </div>

            <button
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await postAction(product.id, { action: 'RECONCILE', reason: 'Reconcile Inventory (admin-triggered)' })
                  router.refresh()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Reconcile failed')
                } finally {
                  setBusy(false)
                }
              }}
              disabled={busy}
              className={`${smallBtn} mb-4`}
            >
              Reconcile Inventory
            </button>

            {product.physicalStockOnHand === null ? (
              <button
                onClick={() => setActiveAction('INITIALIZE')}
                className={`${pillPrimary} px-4 py-2`}
              >
                Initialize Inventory
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(['ADD_STOCK', 'REMOVE_STOCK', 'SET_EXACT_COUNT', 'DAMAGE_LOSS', 'REVERSE_LAST'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveAction(key)}
                    className={smallBtn}
                  >
                    {ACTION_LABEL[key]}
                  </button>
                ))}
              </div>
            )}

            {activeAction && (
              <div className="mt-4 border border-white/10 rounded-xl p-4">
                <p className="font-heading text-[13px] font-bold text-white mb-3">{ACTION_LABEL[activeAction]}</p>
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
                  <label className="flex items-center gap-2 text-[12px] text-white mt-3">
                    <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                    I confirm this change is correct.
                  </label>
                )}

                {error && <p className="text-[12px] text-red-400 mt-3">{error}</p>}

                <div className="flex gap-2 mt-4">
                  <button onClick={runAction} disabled={busy} className={`${pillPrimary} px-4 py-2`}>
                    Save
                  </button>
                  <button onClick={resetActionForm} className={`${pillOutline} px-4 py-2`}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {pricingPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${card} p-6 max-w-lg w-full`}>
            <h3 className={`${sectionHeading} mb-1`}>Review Price Update</h3>
            <p className={`text-[13px] ${mutedText} mb-4`}>
              {product.name} <span className="text-white">{product.size}</span>
            </p>

            <div className="space-y-3 mb-4">
              {pricingPreview.map((diff) => {
                const visibleToCustomers = diff.sellUnit === 'INDIVIDUAL_VIAL' ? individualSalesEnabled : true
                return (
                  <div key={diff.sellUnit} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="font-heading text-[12px] font-bold text-white mb-1">{SELL_UNIT_LABEL[diff.sellUnit]}</p>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className={mutedText}>Existing: {formatPrice(diff.previousPrice)}</span>
                      <span className="text-white">New: {formatPrice(diff.newPrice)}</span>
                      <span className="text-gold font-bold">{formatDifference(diff.previousPrice, diff.newPrice)}</span>
                    </div>
                    <p className={`text-[11px] mt-1 ${visibleToCustomers ? 'text-green-400' : 'text-amber-300'}`}>
                      {visibleToCustomers ? 'Publicly visible on the storefront' : 'Not visible on the storefront (admin only)'}
                    </p>
                  </div>
                )
              })}
            </div>

            <p className={`text-[11px] ${mutedText} mb-4`}>
              This applies to new invoice lines and storefront orders going forward. It will never rewrite historical issued or paid invoices.
            </p>

            {pricingError && <p className="text-[12px] text-red-400 mb-3">{pricingError}</p>}

            <div className="flex gap-2">
              <button onClick={confirmSavePricing} disabled={pricingBusy} className={`${pillPrimary} px-4 py-2`}>
                Confirm & Save
              </button>
              <button onClick={cancelPricingPreview} disabled={pricingBusy} className={`${pillOutline} px-4 py-2`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
