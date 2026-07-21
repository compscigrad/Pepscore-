// Unlimited-row line-item editor: add, duplicate, delete, reorder (up/down),
// inline edit. Items don't require a product-catalog match — the datalist
// autocomplete is a convenience, not a constraint, so ad-hoc items (like the
// spec's "Glow70" sample, which isn't in the seeded catalog) stay supported.
'use client'

import { lineItemTotal } from '@/lib/invoice/calculations'
import { formatMoney } from '@/lib/invoice/format'
import { makeKey } from './types'
import { card, input, pillSecondary, sectionHeading } from './theme'
import type { InvoiceItemDraft, Product } from './types'

interface Props {
  items: InvoiceItemDraft[]
  onChange: (items: InvoiceItemDraft[]) => void
  products: Product[]
}

function emptyItem(): InvoiceItemDraft {
  return { key: makeKey(), productId: null, name: '', description: '', quantity: 1, unitPrice: 0, lineDiscount: 0 }
}

export function InvoiceItemsTable({ items, onChange, products }: Props) {
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
    const copy = { ...source, key: makeKey() }
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

  function pickProduct(key: string, productName: string) {
    const product = products.find((p) => p.name === productName)
    if (!product) {
      updateItem(key, { name: productName })
      return
    }
    updateItem(key, { productId: product.id, name: product.name, unitPrice: product.price })
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
          <option key={p.id} value={p.name} />
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
              {items.map((item, index) => (
                <tr key={item.key} className="border-b border-white/10">
                  <td className="py-2 pr-2">
                    <input
                      className={input}
                      list="product-catalog"
                      value={item.name}
                      placeholder="Product name"
                      onChange={(e) => pickProduct(item.key, e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={1}
                      className={input}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) })}
                    />
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
                    <button type="button" onClick={() => moveItem(item.key, -1)} disabled={index === 0} className="px-1 text-white/50 disabled:opacity-30" aria-label="Move up">↑</button>
                    <button type="button" onClick={() => moveItem(item.key, 1)} disabled={index === items.length - 1} className="px-1 text-white/50 disabled:opacity-30" aria-label="Move down">↓</button>
                    <button type="button" onClick={() => duplicateItem(item.key)} className="px-1 text-gold-light" aria-label="Duplicate">⧉</button>
                    <button type="button" onClick={() => deleteItem(item.key)} className="px-1 text-red-400" aria-label="Delete">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
