// Unlimited-row line-item editor: add, duplicate, delete, reorder (up/down),
// inline edit. Items don't require a product-catalog match — the datalist
// autocomplete is a convenience, not a constraint, so ad-hoc items (like the
// spec's "Glow70" sample, which isn't in the seeded catalog) stay supported.
'use client'

import { useState } from 'react'
import { lineItemTotal } from '@/lib/invoice/calculations'
import { formatMoney, formatProductLabel } from '@/lib/invoice/format'
import { getAvailableSellUnits } from '@/lib/pricing/sellUnits'
import { makeKey } from './types'
import { card, input, pillSecondary, sectionHeading } from './theme'
import { SellUnitCorrectionDialog } from './SellUnitCorrectionDialog'
import type { InvoiceItemDraft, Product } from './types'

interface Props {
  items: InvoiceItemDraft[]
  onChange: (items: InvoiceItemDraft[]) => void
  products: Product[]
  // Only set in edit mode (a real, already-saved invoice) -- the
  // "Correct Sell Unit" admin action only applies to a line item that
  // already exists in the database, never to a row still being composed
  // in a brand-new invoice draft that hasn't been saved yet.
  invoiceId?: string
}

function emptyItem(): InvoiceItemDraft {
  return { key: makeKey(), id: null, productId: null, name: '', description: '', quantity: 1, unitPrice: 0, lineDiscount: 0 }
}

export function InvoiceItemsTable({ items, onChange, products, invoiceId }: Props) {
  const [correctingItemId, setCorrectingItemId] = useState<string | null>(null)
  function updateItem(key: string, patch: Partial<InvoiceItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function addItem() {
    onChange([...items, emptyItem()])
  }

  function duplicateItem(key: string) {
    const source = items.find((i) => i.key === key)
    if (!source) return
    const index = items.findIndex((i) => i.key === key)
    // A duplicate is a brand-new row -- must never carry the source's real
    // database id, or the save would try to update the original row twice.
    const copy = { ...source, key: makeKey(), id: null }
    onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)])
  }

  function deleteItem(key: string) {
    onChange(items.filter((i) => i.key !== key))
  }

  function moveItem(key: string, direction: -1 | 1) {
    const index = items.findIndex((i) => i.key === key)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= items.length) return
    const next = [...items]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    onChange(next)
  }

  // Matches against the full "Name — Size — 1 Box" label, not just the bare
  // product name — the catalog reuses names across strengths (e.g.
  // "Tesamorelin" 5mg vs 10mg), so matching on name alone would silently
  // resolve to whichever same-named row happened to come first, applying
  // the wrong price. The composed label is also what gets saved as the
  // line item's name, so the strength survives onto the invoice/PDF instead
  // of being dropped at selection time.
  function pickProduct(key: string, typedValue: string) {
    const product = products.find((p) => formatProductLabel(p) === typedValue)
    if (!product) {
      updateItem(key, { productId: null, name: typedValue, sellUnit: null, unitsPerSellUnit: null, priceTier: null, skuSnapshot: null, inventoryQuantityConsumed: null })
      return
    }
    // Reset sell-unit selection on every new product pick -- a previous
    // row's Standard Case choice must never silently carry over onto a
    // different product that may not even offer that sell unit.
    updateItem(key, {
      productId: product.id,
      name: formatProductLabel(product),
      unitPrice: product.price,
      sellUnit: null,
      unitsPerSellUnit: null,
      priceTier: null,
      skuSnapshot: null,
      inventoryQuantityConsumed: null,
    })
  }

  function pickSellUnit(key: string, item: InvoiceItemDraft, product: Product, sellUnitValue: string) {
    if (sellUnitValue === '') {
      updateItem(key, { unitPrice: product.price, sellUnit: null, unitsPerSellUnit: null, priceTier: null, skuSnapshot: null, inventoryQuantityConsumed: null })
      return
    }
    const options = getAvailableSellUnits(product, { adminContext: true })
    const option = options.find((o) => o.sellUnit === sellUnitValue)
    if (!option) return
    const priceTier =
      option.sellUnit === 'CASE_STANDARD' ? 'STANDARD' : option.sellUnit === 'CASE_SPA' ? 'SPA' : option.sellUnit === 'CASE_BULK' ? 'BULK' : 'INDIVIDUAL'
    updateItem(key, {
      unitPrice: option.price,
      sellUnit: option.sellUnit,
      unitsPerSellUnit: option.unitsPerSellUnit,
      priceTier,
      skuSnapshot: product.sku,
      inventoryQuantityConsumed: item.quantity * option.unitsPerSellUnit,
    })
  }

  function updateQuantity(key: string, item: InvoiceItemDraft, quantity: number) {
    const patch: Partial<InvoiceItemDraft> = { quantity }
    if (item.unitsPerSellUnit) patch.inventoryQuantityConsumed = quantity * item.unitsPerSellUnit
    updateItem(key, patch)
  }

  return (
    <div className={`${card} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={sectionHeading}>Products</h3>
        <button
          type="button"
          onClick={addItem}
          className={`${pillSecondary} px-4 py-2`}
        >
          + Add Product
        </button>
      </div>

      <datalist id="product-catalog">
        {products.map((p) => (
          <option key={p.id} value={formatProductLabel(p)} />
        ))}
      </datalist>

      {items.length === 0 ? (
        <p className="text-sm text-white/50 py-6 text-center">No products yet — add at least one to continue.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Product</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-20">Qty</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28">Unit Price</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28">Discount</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28 text-right">Total</th>
                <th className="pb-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const matchedProduct = item.productId ? products.find((p) => p.id === item.productId) : undefined
                const sellUnitOptions = matchedProduct ? getAvailableSellUnits(matchedProduct, { adminContext: true }) : []
                return (
                <tr key={item.key} className="border-b border-white/10">
                  <td className="py-2 pr-2">
                    <input
                      className={input}
                      list="product-catalog"
                      value={item.name}
                      placeholder="Product name"
                      onChange={(e) => pickProduct(item.key, e.target.value)}
                    />
                    {sellUnitOptions.length > 0 && (
                      <select
                        className={`${input} mt-1`}
                        value={item.sellUnit ?? ''}
                        onChange={(e) => pickSellUnit(item.key, item, matchedProduct!, e.target.value)}
                      >
                        <option value="">Select sell unit…</option>
                        {sellUnitOptions.map((o) => (
                          <option key={o.sellUnit} value={o.sellUnit}>
                            {o.label} — {formatMoney(o.price)}
                            {!o.visibleToCustomers ? ' (not on storefront)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      className={input}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.key, item, Number(e.target.value))}
                    />
                    {item.unitsPerSellUnit ? (
                      <p className="text-[10px] text-white/40 mt-1">{item.quantity * item.unitsPerSellUnit} vial(s)</p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={input}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.key, { unitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={input}
                      value={item.lineDiscount}
                      onChange={(e) => updateItem(item.key, { lineDiscount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-medium text-white whitespace-nowrap">
                    {formatMoney(lineItemTotal(item))}
                  </td>
                  <td className="py-2 whitespace-nowrap text-right">
                    {invoiceId && item.id && item.productId && (
                      <button
                        type="button"
                        onClick={() => setCorrectingItemId(item.id)}
                        className="px-2 py-0.5 mr-1 rounded border border-amber-400/40 text-amber-300 text-[11px] font-bold uppercase tracking-wide hover:bg-amber-400/10"
                      >
                        Correct Sell Unit
                      </button>
                    )}
                    <button type="button" onClick={() => moveItem(item.key, -1)} disabled={index === 0} className="px-1 text-white/50 disabled:opacity-30" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveItem(item.key, 1)} disabled={index === items.length - 1} className="px-1 text-white/50 disabled:opacity-30" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => duplicateItem(item.key)} className="px-1 text-gold-light" aria-label="Duplicate">⧉</button>
                    <button type="button" onClick={() => deleteItem(item.key)} className="px-1 text-red-400" aria-label="Delete">✕</button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {invoiceId && correctingItemId && (
        <SellUnitCorrectionDialog invoiceId={invoiceId} itemId={correctingItemId} onClose={() => setCorrectingItemId(null)} />
      )}
    </div>
  )
}
