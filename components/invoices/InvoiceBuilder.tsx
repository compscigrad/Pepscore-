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
import { InvoiceStatusSection } from './InvoiceStatusSection'
import { CustomerInfoSection } from './CustomerInfoSection'
import { ShippingSection } from './ShippingSection'
import { InvoiceItemsTable } from './InvoiceItemsTable'
import { DiscountsSection } from './DiscountsSection'
import { PaymentSection } from './PaymentSection'
import { ShipmentsSection } from './ShipmentsSection'
import { BackordersSection } from './BackordersSection'
import { CorrespondenceHistory } from './CorrespondenceHistory'
import { IntakeLinkSection } from './IntakeLinkSection'
import { TotalsSummary } from './TotalsSummary'
import { InvoicePreview } from './InvoicePreview'
import { PDFExportButtons } from './PDFExportButtons'
import { card, mutedText, pillPrimary, sectionHeading } from './theme'
import { makeKey, EMPTY_DRAFT, INVOICE_STATUSES } from './types'
import type { InvoiceDraft, AddressDraft, Product, Promotion } from './types'
import type { InvoiceWithRelations } from '@/lib/invoices'
import type { Customer } from '@prisma/client'

// Turns the server's { error, issues } shape (zod's err.issues, when present)
// into a readable message — the generic top-level "error" string alone
// (e.g. "Validation failed") never says which field, which is unusable in
// practice for a real multi-field form like this one.
function describeApiError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'issues' in data && Array.isArray((data as { issues: unknown }).issues)) {
    const issues = (data as { issues: Array<{ message?: string }> }).issues
    const messages = issues.map((i) => i.message).filter(Boolean)
    if (messages.length > 0) return messages.join('; ')
  }
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  return fallback
}

interface Props {
  mode: 'create' | 'edit'
  initialInvoice?: InvoiceWithRelations
  products: Product[]
  promotions: Promotion[]
  smsConfigured?: boolean
  // Create-mode only — set when arriving from a customer profile's "New
  // Invoice" action. Prefills the customer/shipping fields for review and,
  // on save, links the new invoice to this customer (see the save() payload
  // below) rather than leaving customerId unset the way a plain manual
  // invoice always has until now.
  prefillCustomer?: Customer | null
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

// invoice.status can be PENDING (or, on old rows, a legacy PAID/PARTIALLY_PAID/
// APPROVED value) — none of those are admin-submittable (see
// INVOICE_STATUSES / lib/invoice/validation.ts), so round-tripping them
// straight into the draft would make Save Changes 400 on every subsequent
// edit to an issued-with-a-balance invoice until the admin happened to
// touch the dropdown themselves. Every excluded value implies the invoice
// has already been issued at least once, so ISSUED is always the correct,
// safe stand-in — the server re-derives the real status from balance/
// payments on every save regardless of what's sent here.
function toEditableStatus(status: InvoiceDraft['status']): InvoiceDraft['status'] {
  return INVOICE_STATUSES.includes(status) ? status : 'ISSUED'
}

function itemsToDraft(items: InvoiceWithRelations['items']): InvoiceDraft['items'] {
  return items.map((item) => ({
    key: makeKey(),
    id: item.id,
    productId: item.productId,
    name: item.name,
    description: item.description ?? '',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineDiscount: item.lineDiscount,
  }))
}

function discountsToDraft(discounts: InvoiceWithRelations['discounts']): InvoiceDraft['discounts'] {
  return discounts.map((d) => ({
    key: makeKey(),
    id: d.id,
    promotionId: d.promotionId,
    label: d.label,
    type: d.type,
    amount: d.amount,
  }))
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
    items: itemsToDraft(invoice.items),
    discounts: discountsToDraft(invoice.discounts),
    status: toEditableStatus(invoice.status),
  }
}

function customerToDraft(customer: Customer): InvoiceDraft {
  return {
    ...EMPTY_DRAFT,
    customer: {
      ...EMPTY_DRAFT.customer,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      customerCompany: customer.company ?? '',
      customerEmail: customer.email ?? '',
      customerPhone: customer.phone ?? '',
      billingAddress: toAddressDraft(customer.billingAddress),
    },
    shipping: {
      ...EMPTY_DRAFT.shipping,
      shippingAddress: toAddressDraft(customer.shippingAddress),
    },
  }
}

export function InvoiceBuilder({
  mode,
  initialInvoice,
  products,
  promotions: initialPromotions,
  smsConfigured = false,
  prefillCustomer,
}: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<InvoiceDraft>(() =>
    initialInvoice ? invoiceToDraft(initialInvoice) : prefillCustomer ? customerToDraft(prefillCustomer) : EMPTY_DRAFT
  )
  const [invoice, setInvoice] = useState(initialInvoice)
  const [saving, setSaving] = useState(false)
  // Ephemeral UI convenience, not part of the draft/save payload — what's
  // actually persisted is the shipping address values themselves, kept in
  // sync below for as long as this stays checked.
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(false)
  // Local copy so a newly-created reusable promotion (see DiscountsSection's
  // "+ New Preset") shows up in the picker immediately, without a page reload.
  const [promotions, setPromotions] = useState(initialPromotions)

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
        customerId: mode === 'create' ? prefillCustomer?.id : undefined,
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
      if (!res.ok) throw new Error(describeApiError(data, 'Failed to save invoice'))

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

  // Create-mode-only shortcut: the admin has just a name + phone/email, no
  // products yet, and wants to send an intake request right now rather than
  // build the full invoice first. Creates a zero-item draft (see
  // app/api/admin/invoices/quick-intake/route.ts) and redirects into edit
  // mode, where the existing Request Customer Information section (SMS/
  // email send included) already works — no separate UI to duplicate here.
  const [sendingQuickIntake, setSendingQuickIntake] = useState(false)

  async function sendQuickIntake() {
    if (!draft.customer.customerName.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (!draft.customer.customerEmail.trim() && !draft.customer.customerPhone.trim()) {
      toast.error('Provide at least an email or phone number')
      return
    }

    setSendingQuickIntake(true)
    try {
      const res = await fetch('/api/admin/invoices/quick-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: draft.customer.customerName,
          customerEmail: draft.customer.customerEmail || undefined,
          customerPhone: draft.customer.customerPhone || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(describeApiError(data, 'Failed to start intake request'))

      toast.success('Draft started — send the intake request from here')
      router.push(`/admin/invoices/${data.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start intake request')
    } finally {
      setSendingQuickIntake(false)
    }
  }

  async function refreshInvoice() {
    if (!invoice) return
    const res = await fetch(`/api/admin/invoices/${invoice.id}`)
    if (res.ok) {
      const fresh = await res.json()
      setInvoice(fresh)
      // Several things can change server-side without the draft knowing:
      // recordPayment() can move status (e.g. DRAFT -> PAID), and — the
      // reason this resync exists at all — lib/backorders.ts's
      // applyBackorder/resolveBackorder creates/reads InvoiceDiscount rows
      // through a side-channel API, not through this form's own discount
      // editor. Without resyncing draft.items/discounts here too, the next
      // unrelated "Save Changes" click would submit the *stale* discount
      // list (missing the backorder credit) straight into
      // lib/invoice/rowSync.ts's upsert — which correctly deletes any row
      // "removed" from the payload, silently wiping a real compensation
      // discount off the invoice while the BackorderCompensation record
      // still claims it was applied. Resyncing on every refresh closes that
      // gap the same way status is already kept in sync.
      //
      // status must go through toEditableStatus() here too, not just a raw
      // assignment — a backorder discount (or a payment) can push the
      // invoice's real status to PENDING (the positive-balance overlay),
      // which invoicePayloadSchema deliberately rejects as a submittable
      // value. Assigning it unsanitized left the *next* Save Changes with
      // no way to succeed at all until the admin happened to touch the
      // status dropdown themselves.
      setDraft((d) => ({
        ...d,
        status: toEditableStatus(fresh.status),
        items: itemsToDraft(fresh.items),
        discounts: discountsToDraft(fresh.discounts),
      }))
    }
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
      <div className="space-y-6">
        <InvoiceStatusSection value={draft.status} onChange={(status) => setDraft((d) => ({ ...d, status }))} />
        <CustomerInfoSection
          value={draft.customer}
          onChange={(customer) =>
            setDraft((d) => ({
              ...d,
              customer,
              // Keep shipping mirroring billing live while the checkbox is
              // on, so editing billing after checking it doesn't require
              // re-checking to re-sync.
              shipping: shippingSameAsBilling
                ? { ...d.shipping, shippingAddress: customer.billingAddress }
                : d.shipping,
            }))
          }
        />
        {mode === 'create' ? (
          <div className={`${card} p-6`}>
            <h2 className={`${sectionHeading} mb-1`}>Request Customer Information</h2>
            <p className={`${mutedText} text-sm mb-4`}>
              Don&apos;t have the order details yet? Start a draft from just a name and phone/email, and send the
              client a secure link to fill in the rest themselves.
            </p>
            <button
              type="button"
              onClick={sendQuickIntake}
              disabled={sendingQuickIntake}
              className={`${pillPrimary} px-6 py-2.5`}
            >
              {sendingQuickIntake ? 'Starting...' : 'Start Draft & Send Intake Request'}
            </button>
          </div>
        ) : null}
        <ShippingSection
          value={draft.shipping}
          onChange={(shipping) => setDraft((d) => ({ ...d, shipping }))}
          sameAsBilling={shippingSameAsBilling}
          onSameAsBillingChange={(checked) => {
            setShippingSameAsBilling(checked)
            if (checked) {
              setDraft((d) => ({ ...d, shipping: { ...d.shipping, shippingAddress: d.customer.billingAddress } }))
            }
            // Unchecking intentionally leaves the last-synced address in
            // place — it's now an independent starting point to edit, not
            // cleared, since it may already be correct as-is.
          }}
        />
        <InvoiceItemsTable
          items={draft.items}
          onChange={(items) => setDraft((d) => ({ ...d, items }))}
          products={products}
        />
        <DiscountsSection
          discounts={draft.discounts}
          onChange={(discounts) => setDraft((d) => ({ ...d, discounts }))}
          promotions={promotions}
          onPromotionCreated={(promotion) => setPromotions((prev) => [...prev, promotion])}
          itemsTotal={totals.itemsTotal}
        />
        <TotalsSummary totals={totals} shippingCost={draft.shipping.shippingCost} amountPaid={invoice?.amountPaid} />

        {mode === 'edit' && invoice ? (
          <IntakeLinkSection
            invoiceId={invoice.id}
            intakeLinks={invoice.intakeLinks}
            onLinkUpdated={refreshInvoice}
            customerEmail={invoice.customerEmail}
            customerPhone={invoice.customerPhone}
            smsConfigured={smsConfigured}
          />
        ) : null}

        {mode === 'edit' && invoice ? (
          <ShipmentsSection invoiceId={invoice.id} shipments={invoice.shipments} onTrackingUpdated={refreshInvoice} />
        ) : null}

        {mode === 'edit' && invoice ? (
          <BackordersSection
            invoiceId={invoice.id}
            items={invoice.items.map((item) => ({ id: item.id, name: item.name }))}
            deliveryStatus={invoice.deliveryStatus}
            onBackorderUpdated={refreshInvoice}
          />
        ) : null}

        {mode === 'edit' && invoice ? (
          <PaymentSection
            invoiceId={invoice.id}
            payments={invoice.payments}
            amountPaid={invoice.amountPaid}
            total={invoice.total}
            balanceDue={invoice.balanceDue}
            paymentArrangement={invoice.paymentArrangement}
            onPaymentRecorded={refreshInvoice}
          />
        ) : null}

        {mode === 'edit' && invoice ? <CorrespondenceHistory invoiceId={invoice.id} /> : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`${pillPrimary} px-8 py-3`}
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create Invoice' : 'Save Changes'}
          </button>
          {mode === 'edit' && invoice ? (
            <PDFExportButtons invoiceId={invoice.id} customerEmail={invoice.customerEmail} />
          ) : null}
        </div>
      </div>

      <InvoicePreview draft={draft} totals={totals} invoiceNumber={invoice?.invoiceNumber} />
    </div>
  )
}
