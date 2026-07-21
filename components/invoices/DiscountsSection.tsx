// Apply one or more reusable promotions and/or ad-hoc discounts. Stacking
// works because each discount resolves independently against the items
// total (see lib/invoice/calculations.ts) rather than compounding.
'use client'

import { resolveDiscountAmount } from '@/lib/invoice/calculations'
import { formatMoney } from '@/lib/invoice/format'
import { makeKey } from './types'
import { card, input, pillSecondary, sectionHeading } from './theme'
import type { InvoiceDiscountDraft, Promotion } from './types'

interface Props {
  discounts: InvoiceDiscountDraft[]
  onChange: (discounts: InvoiceDiscountDraft[]) => void
  promotions: Promotion[]
  itemsTotal: number
}

export function DiscountsSection({ discounts, onChange, promotions, itemsTotal }: Props) {
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

  const availablePromotions = promotions.filter((p) => !discounts.some((d) => d.promotionId === p.id))

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={sectionHeading}>Discounts &amp; Promotions</h3>
        <div className="flex gap-2">
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
        </div>
      </div>

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
