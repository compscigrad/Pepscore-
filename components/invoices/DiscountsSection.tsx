// Apply one or more reusable promotions and/or ad-hoc discounts. Stacking
// works because each discount resolves independently against the items
// total (see lib/invoice/calculations.ts) rather than compounding.
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { resolveDiscountAmount } from '@/lib/invoice/calculations'
import { formatMoney } from '@/lib/invoice/format'
import { makeKey } from './types'
import { card, input, pillPrimary, pillSecondary, sectionHeading } from './theme'
import type { InvoiceDiscountDraft, Promotion } from './types'

interface Props {
  discounts: InvoiceDiscountDraft[]
  onChange: (discounts: InvoiceDiscountDraft[]) => void
  promotions: Promotion[]
  onPromotionCreated: (promotion: Promotion) => void
  itemsTotal: number
}

export function DiscountsSection({ discounts, onChange, promotions, onPromotionCreated, itemsTotal }: Props) {
  const [creatingPreset, setCreatingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetType, setPresetType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED')
  const [presetAmount, setPresetAmount] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  function addPromotion(promotionId: string) {
    const promo = promotions.find((p) => p.id === promotionId)
    if (!promo) return
    onChange([
      ...discounts,
      { key: makeKey(), promotionId: promo.id, label: promo.name, type: promo.type, amount: promo.amount },
    ])
  }

  function addCustomDiscount() {
    onChange([...discounts, { key: makeKey(), promotionId: null, label: '', type: 'FIXED', amount: 0 }])
  }

  function updateDiscount(key: string, patch: Partial<InvoiceDiscountDraft>) {
    onChange(discounts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  function removeDiscount(key: string) {
    onChange(discounts.filter((d) => d.key !== key))
  }

  // Saves a one-off discount (e.g. "FF (Friends & Family)") as a reusable
  // named preset — a real Promotion row, not just a line on this invoice —
  // so it shows up in "Apply Promotion..." on every future invoice too.
  async function savePreset(e: React.FormEvent) {
    e.preventDefault()
    if (!presetName.trim()) {
      toast.error('Enter a name for the preset')
      return
    }
    const amount = Number(presetAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter an amount greater than zero')
      return
    }

    setSavingPreset(true)
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), type: presetType, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save preset')

      onPromotionCreated(data)
      onChange([
        ...discounts,
        { key: makeKey(), promotionId: data.id, label: data.name, type: data.type, amount: data.amount },
      ])
      toast.success(`Saved "${data.name}" as a reusable preset`)
      setPresetName('')
      setPresetAmount('')
      setPresetType('FIXED')
      setCreatingPreset(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setSavingPreset(false)
    }
  }

  const availablePromotions = promotions.filter((p) => !discounts.some((d) => d.promotionId === p.id))

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className={sectionHeading}>Discounts &amp; Promotions</h3>
        <div className="flex gap-2 flex-wrap">
          {availablePromotions.length > 0 && (
            <select
              className="rounded-full border border-white/15 bg-white/5 text-white text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gold/40"
              value=""
              onChange={(e) => e.target.value && addPromotion(e.target.value)}
              aria-label="Apply a promotion"
            >
              <option value="">+ Apply Promotion...</option>
              {availablePromotions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type === 'PERCENTAGE' ? `${p.amount}%` : formatMoney(p.amount)})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={addCustomDiscount}
            className={`${pillSecondary} px-4 py-1.5`}
          >
            + Custom Discount
          </button>
          <button
            type="button"
            onClick={() => setCreatingPreset((v) => !v)}
            className={`${pillSecondary} px-4 py-1.5`}
          >
            + New Preset
          </button>
        </div>
      </div>

      {creatingPreset ? (
        <form onSubmit={savePreset} className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1" htmlFor="presetName">
              Name (e.g. &quot;FF (Friends &amp; Family)&quot;)
            </label>
            <input
              id="presetName"
              className={input}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1" htmlFor="presetType">
              Type
            </label>
            <select
              id="presetType"
              className={`${input} w-32`}
              value={presetType}
              onChange={(e) => setPresetType(e.target.value as 'FIXED' | 'PERCENTAGE')}
            >
              <option value="FIXED">$ Fixed</option>
              <option value="PERCENTAGE">% Percent</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1" htmlFor="presetAmount">
              Amount
            </label>
            <input
              id="presetAmount"
              type="number"
              min={0}
              step="0.01"
              className={`${input} w-24`}
              value={presetAmount}
              onChange={(e) => setPresetAmount(e.target.value)}
            />
          </div>
          <button type="submit" disabled={savingPreset} className={`${pillPrimary} px-4 py-2`}>
            {savingPreset ? 'Saving...' : 'Save & Apply'}
          </button>
          <button
            type="button"
            onClick={() => setCreatingPreset(false)}
            className="text-sm text-white/50 px-2 py-2 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
        </form>
      ) : null}

      {discounts.length === 0 ? (
        <p className="text-sm text-white/50">No discounts applied.</p>
      ) : (
        <div className="space-y-2">
          {discounts.map((discount) => (
            <div key={discount.key} className="flex items-center gap-2">
              <input
                className={`${input} flex-1`}
                placeholder="Label"
                value={discount.label}
                onChange={(e) => updateDiscount(discount.key, { label: e.target.value })}
                disabled={!!discount.promotionId}
              />
              <select
                className={`${input} w-32`}
                value={discount.type}
                onChange={(e) => updateDiscount(discount.key, { type: e.target.value as InvoiceDiscountDraft['type'] })}
                disabled={!!discount.promotionId}
              >
                <option value="FIXED">$ Fixed</option>
                <option value="PERCENTAGE">% Percent</option>
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                className={`${input} w-24`}
                value={discount.amount}
                onChange={(e) => updateDiscount(discount.key, { amount: Number(e.target.value) })}
                disabled={!!discount.promotionId}
              />
              <span className="w-24 text-right text-sm font-medium text-white whitespace-nowrap">
                -{formatMoney(resolveDiscountAmount(discount, itemsTotal))}
              </span>
              <button
                type="button"
                onClick={() => removeDiscount(discount.key)}
                className="text-red-400 px-1"
                aria-label={`Remove ${discount.label || 'discount'}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
