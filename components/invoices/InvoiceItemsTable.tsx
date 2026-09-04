// Unlimited-row line-item editor: add, duplicate, delete, reorder (up/down),
// inline edit. Items don't require a product-catalog match — the datalist
// autocomplete is a convenience, not a constraint, so ad-hoc items (like the
// spec's "Glow70" sample, which isn't in the seeded catalog) stay supported.
'use client'

import { useState } from 'react'
import { lineItemTotal } from '@/lib/invoice/calculations'
import { formatMoney, formatProductLabel } from '@/lib/invoice/format'
import { getAvailableSellUnits } from '@/lib/pricing/sellUnits'
import { checkPriceDeviation, getInvoiceLinePriceTier, type PriceTierField } from '@/lib/pricing/lineOverride'
// Pure, DB-free (see canonicalPricing.ts's own header) -- safe to import
// directly into this client component, same discipline as the local round2
// below re: never pulling in lib/invoices.ts's Prisma-backed helpers.
import { resolveCanonicalPricing, type PricingProduct } from '@/lib/pricing/canonicalPricing'
import { makeKey } from './types'
import { card, input, label as labelCls, pillPrimary, pillOutline, pillSecondary, sectionHeading, mutedText } from './theme'
import { SellUnitCorrectionDialog } from './SellUnitCorrectionDialog'
import type { InvoiceItemDraft, Product } from './types'

interface Props {
  items: InvoiceItemDraft[]
  onChange: (items: InvoiceItemDraft[]) => void
  products: Product[]
  // Reflects an "Update Product Price" choice (Phase 3B item 3) back into
  // the parent's product list immediately, so a later line for the same
  // product in this same draft sees the new authoritative price -- without
  // reloading the page, which would discard any other unsaved edits on
  // this form.
  onProductPriceUpdated: (productId: string, field: PriceTierField, newPrice: number) => void
  // Only set in edit mode (a real, already-saved invoice) -- the
  // "Correct Sell Unit" admin action only applies to a line item that
  // already exists in the database, never to a row still being composed
  // in a brand-new invoice draft that hasn't been saved yet.
  invoiceId?: string
  // Whether the invoice's currently-selected customer has an active
  // Professional Access entitlement (2026-08-19 Professional Access sprint,
  // admin-parity requirement) -- resolved by the parent from the real
  // Customer record, same as every other pricing surface. Drives two
  // things here: picking a product with a Professional price defaults the
  // line to CASE_PRO automatically (never manually remembered), and
  // CASE_STANDARD lines never receive the standard volume ladder (it
  // doesn't apply once the customer is Professional-eligible, even for a
  // line an admin deliberately left on CASE_STANDARD).
  proEligible: boolean
  // Active Customer Preferred Pricing for this invoice's selected customer
  // (2026-08-20 Price Match sprint) -- keyed `${productId}:${sellUnit}`,
  // resolved server-side by the parent from real PriceMatchAuthorization
  // rows (lib/pricing/preferredPricing.ts), never client-submitted. Plain
  // Record, not a Map, since this crosses the server-to-client-component
  // prop boundary. Omitted/empty for a brand-new invoice with no customer
  // selected yet, or a customer with no active grants.
  preferredPrices?: Record<string, number>
}

function preferredPriceKey(productId: string, sellUnit: string): string {
  return `${productId}:${sellUnit}`
}

// Local, not imported from lib/invoices.ts's round2 -- that file pulls in
// Prisma and is server-only; importing it here would bundle Prisma into
// this client component (same class of bundling issue documented at
// lib/promotions/firstOrderOfferClaim.ts's own header comment).
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyItem(): InvoiceItemDraft {
  return { key: makeKey(), id: null, productId: null, name: '', description: '', quantity: 1, unitPrice: 0, lineDiscount: 0 }
}

interface PriceCorrectionPrompt {
  itemKey: string
  productId: string
  productLabel: string
  tierField: PriceTierField
  invoiceLinePriceTier: ReturnType<typeof getInvoiceLinePriceTier>
  typedPrice: number
  authoritativePrice: number
}

export function InvoiceItemsTable({ items, onChange, products, onProductPriceUpdated, invoiceId, proEligible, preferredPrices }: Props) {
  const [correctingItemId, setCorrectingItemId] = useState<string | null>(null)
  const [pricePrompt, setPricePrompt] = useState<PriceCorrectionPrompt | null>(null)
  const [pricePromptBusy, setPricePromptBusy] = useState(false)
  const [pricePromptError, setPricePromptError] = useState<string | null>(null)

  function updateItem(key: string, patch: Partial<InvoiceItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  // Admin-parity automatic pricing (section 5) -- recomputes every
  // CASE_STANDARD line's price from the canonical engine's volume ladder,
  // aggregated across all such lines in this invoice, exactly like
  // checkout does for the storefront. Deliberately skips any line the
  // admin has explicitly manually overridden (manualPricingOverride) --
  // that's the auditable, intentional escape hatch this sprint's spec
  // requires preserving. Free-typed lines with no matched product are also
  // untouched (nothing to look up a catalog price from). Called after any
  // change that could shift the aggregate qualifying-case count: adding a
  // line, changing a sell unit, or changing a quantity.
  function recomputeVolumePricing(nextItems: InvoiceItemDraft[]): InvoiceItemDraft[] {
    const standardLineKeys = nextItems
      .filter((it) => it.sellUnit === 'CASE_STANDARD' && it.productId && !it.manualPricingOverride)
      .map((it) => it.key)
    if (standardLineKeys.length === 0) return nextItems

    const requests = standardLineKeys.map((key) => {
      const it = nextItems.find((i) => i.key === key)!
      const product = products.find((p) => p.id === it.productId)!
      const pricingProduct: PricingProduct = {
        activeStandardCasePrice: product.activeStandardCasePrice,
        activeProCasePrice: product.activeProCasePrice,
        activeBulkPrice: product.activeBulkPrice,
        activeIndividualVialPrice: product.activeIndividualVialPrice,
        individualSalesEnabled: product.individualSalesEnabled,
        unitsPerCase: product.unitsPerCase,
      }
      return {
        product: pricingProduct,
        sellUnit: it.sellUnit,
        quantity: it.quantity,
        preferredPrice: preferredPrices?.[preferredPriceKey(it.productId!, it.sellUnit ?? 'CASE_STANDARD')] ?? null,
      }
    })

    // allowManualOverride: true -- this is the admin-composition context
    // (getAvailableSellUnits' own precedent); the volume ladder itself is
    // computed the same way regardless, this only affects entitlement
    // enforcement for CASE_PRO/INDIVIDUAL_VIAL, which never reach this
    // function (it only ever touches CASE_STANDARD lines).
    const resolved = resolveCanonicalPricing(requests, { proEligible: false, allowManualOverride: true })

    const priceByKey = new Map(standardLineKeys.map((key, idx) => [key, resolved[idx]]))
    return nextItems.map((it) => {
      const r = priceByKey.get(it.key)
      if (!r) return it
      return { ...it, unitPrice: r.unitPrice }
    })
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
    // Cost of Goods default (2026-08-19 Finance COGS-coverage fix) --
    // InvoiceItem.costOfGoods is read by lib/finance/reports.ts as a
    // PER-LINE-QUANTITY-UNIT value (multiplied by item.quantity at read
    // time, `(i.costOfGoods ?? 0) * i.quantity`) -- confirmed by reading
    // that consumer before writing this, since it's a different convention
    // than OrderItem.costOfGoods (a pre-multiplied line total, set once at
    // storefront checkout). With no sell unit selected, quantity IS the
    // vial count, so the per-vial Product.costOfGoods is used as-is.
    // Always admin-editable afterward -- a starting point, not an enforced
    // value, since real per-sale cost can differ (batch/lot) from the
    // catalog baseline.
    const defaultCostOfGoods = product.costOfGoods > 0 ? product.costOfGoods : null

    // Admin parity (section 5): a Professional-eligible customer buying a
    // product that has a Professional price defaults straight to CASE_PRO
    // -- the admin never has to remember to pick it manually. Any other
    // product (no Professional price, or a non-Professional customer)
    // resets to no sell unit selected, exactly as before.
    const proOption = proEligible && product.activeProCasePrice !== null
      ? getAvailableSellUnits({
          activeStandardCasePrice: product.activeStandardCasePrice,
          activeProCasePrice: product.activeProCasePrice,
          activeBulkPrice: product.activeBulkPrice,
          activeIndividualVialPrice: product.activeIndividualVialPrice,
          individualSalesEnabled: product.individualSalesEnabled,
          unitsPerCase: product.unitsPerCase,
        }, { adminContext: true }).find((o) => o.sellUnit === 'CASE_PRO')
      : undefined

    // Preferred Price parity (Price Match sprint): CASE_PRO lines never
    // pass through recomputeVolumePricing (it only touches CASE_STANDARD),
    // so a matching active authorization -- if lower than the Professional
    // price -- is applied here directly. Never higher than proOption.price,
    // matching the canonical engine's own "always the lower of the two"
    // rule for this same product/sellUnit.
    const proPreferredPrice = proOption ? preferredPrices?.[preferredPriceKey(product.id, 'CASE_PRO')] : undefined
    const proUnitPrice = proOption && proPreferredPrice != null && proPreferredPrice < proOption.price ? proPreferredPrice : proOption?.price

    const patch: Partial<InvoiceItemDraft> = proOption
      ? {
          productId: product.id,
          name: formatProductLabel(product),
          unitPrice: proUnitPrice!,
          sellUnit: 'CASE_PRO',
          unitsPerSellUnit: proOption.unitsPerSellUnit,
          priceTier: getInvoiceLinePriceTier('CASE_PRO'),
          skuSnapshot: product.sku,
          inventoryQuantityConsumed: 1 * proOption.unitsPerSellUnit,
          costOfGoods: product.costOfGoods > 0 ? round2(product.costOfGoods * proOption.unitsPerSellUnit) : null,
        }
      : {
          // Reset sell-unit selection on every new product pick -- a
          // previous row's Standard Case choice must never silently carry
          // over onto a different product that may not even offer that
          // sell unit.
          productId: product.id,
          name: formatProductLabel(product),
          unitPrice: product.price,
          sellUnit: null,
          unitsPerSellUnit: null,
          priceTier: null,
          skuSnapshot: null,
          inventoryQuantityConsumed: null,
          costOfGoods: defaultCostOfGoods,
        }

    const next = items.map((it) => (it.key === key ? { ...it, ...patch } : it))
    onChange(recomputeVolumePricing(next))
  }

  function pickSellUnit(key: string, item: InvoiceItemDraft, product: Product, sellUnitValue: string) {
    if (sellUnitValue === '') {
      const next = items.map((it) => (it.key === key ? { ...it, unitPrice: product.price, sellUnit: null, unitsPerSellUnit: null, priceTier: null, skuSnapshot: null, inventoryQuantityConsumed: null } : it))
      onChange(recomputeVolumePricing(next))
      return
    }
    const options = getAvailableSellUnits(product, { adminContext: true })
    const option = options.find((o) => o.sellUnit === sellUnitValue)
    if (!option) return
    const next = items.map((it) =>
      it.key === key
        ? {
            ...it,
            unitPrice: option.price,
            sellUnit: option.sellUnit,
            unitsPerSellUnit: option.unitsPerSellUnit,
            priceTier: getInvoiceLinePriceTier(option.sellUnit),
            skuSnapshot: product.sku,
            inventoryQuantityConsumed: item.quantity * option.unitsPerSellUnit,
            // Per-line-quantity-unit, matching the same convention as the
            // plain pickProduct() default above -- item.quantity here
            // counts sell units (e.g. cases), not vials, so the per-vial
            // Product.costOfGoods is scaled up to a per-case cost via
            // unitsPerSellUnit, not by the vial count itself (Finance's own
            // reader multiplies by item.quantity, i.e. case count, at read
            // time).
            costOfGoods: product.costOfGoods > 0 ? round2(product.costOfGoods * option.unitsPerSellUnit) : null,
            // A fresh manual sell-unit pick is itself an explicit admin
            // choice, not a deviation -- clear any earlier manual price
            // override so the volume ladder (or Professional price) applies
            // cleanly to this now-different tier.
            manualPricingOverride: false,
          }
        : it
    )
    onChange(recomputeVolumePricing(next))
  }

  function updateQuantity(key: string, item: InvoiceItemDraft, quantity: number) {
    const patch: Partial<InvoiceItemDraft> = { quantity }
    if (item.unitsPerSellUnit) patch.inventoryQuantityConsumed = quantity * item.unitsPerSellUnit
    const next = items.map((it) => (it.key === key ? { ...it, ...patch } : it))
    onChange(recomputeVolumePricing(next))
  }

  // Checked on blur (not on every keystroke) so typing a price doesn't pop a
  // dialog mid-edit -- only once the admin has settled on a value that
  // genuinely deviates from the product's current catalog price for this
  // line's selected tier.
  function checkUnitPriceOnBlur(item: InvoiceItemDraft) {
    const product = item.productId ? products.find((p) => p.id === item.productId) : undefined
    if (!product) return
    const deviation = checkPriceDeviation({ sellUnit: item.sellUnit ?? null, typedUnitPrice: item.unitPrice, product })
    if (!deviation.needsPrompt || !deviation.tierField || !item.sellUnit) return
    setPricePromptError(null)
    setPricePrompt({
      itemKey: item.key,
      productId: product.id,
      productLabel: formatProductLabel(product),
      tierField: deviation.tierField,
      invoiceLinePriceTier: getInvoiceLinePriceTier(item.sellUnit),
      typedPrice: item.unitPrice,
      authoritativePrice: deviation.authoritativePrice!,
    })
  }

  function useOnce() {
    if (!pricePrompt) return
    updateItem(pricePrompt.itemKey, { manualPricingOverride: true, priceTier: 'MANUAL' })
    setPricePrompt(null)
  }

  function cancelPricePrompt() {
    if (!pricePrompt) return
    // Revert to the catalog price rather than leaving an unflagged
    // deviation sitting silently in the line -- the admin explicitly
    // declined both options, so nothing about this line should look edited.
    updateItem(pricePrompt.itemKey, { unitPrice: pricePrompt.authoritativePrice })
    setPricePrompt(null)
  }

  async function updateProductPrice() {
    if (!pricePrompt) return
    setPricePromptBusy(true)
    setPricePromptError(null)
    try {
      const res = await fetch(`/api/admin/inventory/${pricePrompt.productId}/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Only the one tier field that actually changed -- never resend the
        // other three from stale local state, which could silently revert a
        // tier nobody meant to touch.
        body: JSON.stringify({ [pricePrompt.tierField]: pricePrompt.typedPrice, source: 'INVOICE_LINE_UPDATE_PRODUCT_PRICE' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to update product price')
      }
      onProductPriceUpdated(pricePrompt.productId, pricePrompt.tierField, pricePrompt.typedPrice)
      updateItem(pricePrompt.itemKey, { unitPrice: pricePrompt.typedPrice, manualPricingOverride: false, priceTier: pricePrompt.invoiceLinePriceTier })
      setPricePrompt(null)
    } catch (e) {
      setPricePromptError(e instanceof Error ? e.message : 'Failed to update product price')
    } finally {
      setPricePromptBusy(false)
    }
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
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50">Product / Sell As</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-20">Qty</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28">Unit Price</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28">Discount</th>
                <th className="pb-2 font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 w-28">COGS (per unit)</th>
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
                      <div className="mt-2">
                        <label htmlFor={`sell-as-${item.key}`} className={`${labelCls} mb-1`}>Sell As</label>
                        <select
                          id={`sell-as-${item.key}`}
                          className={`${input} ${item.sellUnit ? '' : 'border-gold/40 ring-1 ring-gold/20'}`}
                          value={item.sellUnit ?? ''}
                          onChange={(e) => pickSellUnit(item.key, item, matchedProduct!, e.target.value)}
                        >
                          <option value="">Choose case, bulk, professional, or individual vial…</option>
                          {sellUnitOptions.map((o) => (
                            <option key={o.sellUnit} value={o.sellUnit}>
                              {o.label} — {formatMoney(o.price)}
                              {!o.visibleToCustomers ? ' (not on storefront)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
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
                      onBlur={() => checkUnitPriceOnBlur(item)}
                    />
                    {item.manualPricingOverride && item.priceTier === 'MANUAL' && (
                      <p className="text-[10px] text-amber-300 mt-1">Manual override — this line only</p>
                    )}
                    {!item.manualPricingOverride && item.sellUnit === 'CASE_STANDARD' && matchedProduct?.activeStandardCasePrice != null && item.unitPrice < matchedProduct.activeStandardCasePrice && (
                      <p className="text-[10px] text-emerald-300 mt-1">Volume discount applied automatically</p>
                    )}
                    {!item.manualPricingOverride && item.sellUnit === 'CASE_PRO' && (
                      <p className="text-[10px] text-gold-light mt-1">Professional Access pricing</p>
                    )}
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
                    {item.lineDiscount > 0 && (
                      <p className="text-[10px] text-amber-300 mt-1">
                        -{formatMoney(item.lineDiscount)} off {formatMoney(item.quantity * item.unitPrice)}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={input}
                      placeholder="Unknown"
                      value={item.costOfGoods ?? ''}
                      onChange={(e) => updateItem(item.key, { costOfGoods: e.target.value === '' ? null : Number(e.target.value) })}
                      title="Cost of goods PER UNIT of this line's own quantity (e.g. per case if a case sell-unit is selected) -- defaults from the product's catalog cost when available, always editable"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right font-medium text-white whitespace-nowrap">
                    {item.lineDiscount > 0 && (
                      <span className="block text-[10px] text-white/40 line-through">
                        {formatMoney(item.quantity * item.unitPrice)}
                      </span>
                    )}
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

      {pricePrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`${card} p-6 max-w-md w-full`}>
            <h3 className={`${sectionHeading} mb-2`}>How should this price change be applied?</h3>
            <p className={`text-[13px] ${mutedText} mb-4`}>
              {pricePrompt.productLabel}: catalog price is {formatMoney(pricePrompt.authoritativePrice)}, you entered {formatMoney(pricePrompt.typedPrice)}.
            </p>
            {pricePromptError && <p className="text-[12px] text-red-400 mb-3">{pricePromptError}</p>}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={useOnce} disabled={pricePromptBusy} className={`${pillOutline} px-4 py-2 text-left`}>
                <span className="block font-bold">Use Once</span>
                <span className={`block text-[11px] ${mutedText} font-normal`}>Change only this invoice line. Catalog pricing stays as-is.</span>
              </button>
              <button type="button" onClick={updateProductPrice} disabled={pricePromptBusy} className={`${pillPrimary} px-4 py-2 text-left`}>
                <span className="block font-bold">Update Product Price</span>
                <span className="block text-[11px] font-normal opacity-80">Use this value on this invoice, and update the product&apos;s catalog price for future orders.</span>
              </button>
              <button type="button" onClick={cancelPricePrompt} disabled={pricePromptBusy} className="text-[12px] text-white/50 hover:text-white text-center mt-1">
                Cancel — revert to catalog price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
