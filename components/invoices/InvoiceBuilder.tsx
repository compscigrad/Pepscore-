// Composition root for creating/editing an invoice. Owns all form state in
// one place — every keystroke updates this state, which flows straight into
// InvoicePreview with no network round-trip and no reload. That's the whole
// mechanism behind the spec's "live preview" requirement; there's no
// separate preview-fetching logic to keep in sync.
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { calculateInvoiceTotals } from '@/lib/invoice/calculations'
import { CustomerInfoSection } from './CustomerInfoSection'
import { ShippingSection } from './ShippingSection'
import { InvoiceItemsTable } from './InvoiceItemsTable'
import { DiscountsSection } from './DiscountsSection'
import { PaymentSection } from './PaymentSection'
import { TotalsSummary } from './TotalsSummary'
import { InvoicePreview } from './InvoicePreview'
import { PDFExportButtons } from './PDFExportButtons'
import { makeKey, EMPTY_DRAFT } from './types'
import type { InvoiceDraft, AddressDraft, Product, Promotion } from './types'
import type { InvoiceWithRelations } from '@/lib/invoices'

interface Props {
  mode: 'create' | 'edit'
  initialInvoice?: InvoiceWithRelations
  products: Product[]
  promotions: Promotion[]
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

function toAddressDraft(value: unknown): AddressDraft {
  if (!value || typeof value !== 'object') return { street1: '', street2: '', city: '', state: '', zip: '', country: 'US' }
  const a = value as Record<string, string | undefined>
  return {
    street1: a.street1 ?? '',
    street2: a.street2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    zip: a.zip ?? '',
    country: a.country ?? 'US',
  }
}

function invoiceToDraft(invoice: InvoiceWithRelations): InvoiceDraft {
  return {
    orderId: invoice.orderId,
    customer: {
      customerName: invoice.customerName,
      customerCompany: invoice.customerCompany ?? '',
      customerEmail: invoice.customerEmail ?? '',
      customerPhone: invoice.customerPhone ?? '',
      billingAddress: toAddressDraft(invoice.billingAddress),
      internalNotes: invoice.internalNotes ?? '',
      publicNotes: invoice.publicNotes ?? '',
    },
    shipping: {
      shippingAddress: toAddressDraft(invoice.shippingAddress),
      carrier: invoice.carrier ?? '',
      trackingNumber: invoice.trackingNumber ?? '',
      shippingCost: invoice.shippingCost,
      shipDate: toDateInputValue(invoice.shipDate),
      deliveryDate: toDateInputValue(invoice.deliveryDate),
      deliveredDate: toDateInputValue(invoice.deliveredDate),
      deliveryStatus: invoice.deliveryStatus,
    },
    items: invoice.items.map((item) => ({
      key: makeKey(),
      productId: item.productId,
      name: item.name,
      description: item.description ?? '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineDiscount: item.lineDiscount,
    })),
    discounts: invoice.discounts.map((d) => ({
      key: makeKey(),
      promotionId: d.promotionId,
      label: d.label,
      type: d.type,
      amount: d.amount,
    })),
    status: invoice.status,
  }
}

export function InvoiceBuilder({ mode, initialInvoice, products, promotions }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<InvoiceDraft>(() => (initialInvoice ? invoiceToDraft(initialInvoice) : EMPTY_DRAFT))
  const [invoice, setInvoice] = useState(initialInvoice)
  const [saving, setSaving] = useState(false)

  const totals = useMemo(
    () =>
      calculateInvoiceTotals(draft.items, draft.discounts, draft.shipping.shippingCost, invoice?.amountPaid ?? 0),
    [draft.items, draft.discounts, draft.shipping.shippingCost, invoice?.amountPaid]
  )

  async function save() {
    if (!draft.customer.customerName.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (draft.items.length === 0) {
      toast.error('At least one product is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        orderId: draft.orderId,
        customerName: draft.customer.customerName,
        customerCompany: draft.customer.customerCompany || undefined,
        customerEmail: draft.customer.customerEmail || undefined,
        customerPhone: draft.customer.customerPhone || undefined,
        billingAddress: draft.customer.billingAddress.street1 ? draft.customer.billingAddress : undefined,
        shippingAddress: draft.shipping.shippingAddress.street1 ? draft.shipping.shippingAddress : undefined,
        internalNotes: draft.customer.internalNotes || undefined,
        publicNotes: draft.customer.publicNotes || undefined,
        carrier: draft.shipping.carrier || undefined,
        trackingNumber: draft.shipping.trackingNumber || undefined,
        shippingCost: draft.shipping.shippingCost,
        shipDate: draft.shipping.shipDate || undefined,
        deliveryDate: draft.shipping.deliveryDate || undefined,
        deliveredDate: draft.shipping.deliveredDate || undefined,
        deliveryStatus: draft.shipping.deliveryStatus,
        items: draft.items.map((item, index) => ({
          productId: item.productId || undefined,
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineDiscount: item.lineDiscount,
          sortOrder: index,
        })),
        discounts: draft.discounts.map((d) => ({
          promotionId: d.promotionId || undefined,
          label: d.label,
          type: d.type,
          amount: d.amount,
        })),
        status: draft.status,
      }

      const url = mode === 'create' ? '/api/admin/invoices' : `/api/admin/invoices/${invoice!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save invoice')

      toast.success(mode === 'create' ? 'Invoice created' : 'Invoice saved')
      if (mode === 'create') {
        router.push(`/admin/invoices/${data.id}`)
      } else {
        setInvoice(data)
        router.refresh()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  async function refreshInvoice() {
    if (!invoice) return
    const res = await fetch(`/api/admin/invoices/${invoice.id}`)
    if (res.ok) setInvoice(await res.json())
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
      <div className="space-y-6">
        <CustomerInfoSection value={draft.customer} onChange={(customer) => setDraft((d) => ({ ...d, customer }))} />
        <ShippingSection value={draft.shipping} onChange={(shipping) => setDraft((d) => ({ ...d, shipping }))} />
        <InvoiceItemsTable
          items={draft.items}
          onChange={(items) => setDraft((d) => ({ ...d, items }))}
          products={products}
        />
        <DiscountsSection
          discounts={draft.discounts}
          onChange={(discounts) => setDraft((d) => ({ ...d, discounts }))}
          promotions={promotions}
          itemsTotal={totals.itemsTotal}
        />
        <TotalsSummary totals={totals} shippingCost={draft.shipping.shippingCost} amountPaid={invoice?.amountPaid} />

        {mode === 'edit' && invoice ? (
          <PaymentSection
            invoiceId={invoice.id}
            payments={invoice.payments}
            balanceDue={invoice.balanceDue}
            onPaymentRecorded={refreshInvoice}
          />
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-gold text-white text-sm font-bold px-8 py-3 hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create Invoice' : 'Save Changes'}
          </button>
          {mode === 'edit' && invoice ? <PDFExportButtons invoiceId={invoice.id} /> : null}
        </div>
      </div>

      <InvoicePreview draft={draft} totals={totals} invoiceNumber={invoice?.invoiceNumber} />
    </div>
  )
}
