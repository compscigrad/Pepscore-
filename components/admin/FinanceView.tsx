'use client'

// Admin -> Finance client shell (2026-08-12 Finance sprint). Tabs instead
// of separate pages -- the sprint's own IA target lists Finance as one
// section with several report *types*, not several nav destinations, and
// the admin cleanup half of this same sprint explicitly asks to reduce
// page/section sprawl rather than add to it.
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { FinanceDashboardMetrics, DiscountCreditRow, RefundReportRow, InventoryLossRow, VendorReportRow } from '@/lib/finance/reports'
import type { ResolvedFinanceRange, FinanceRangeKey } from '@/lib/finance/dateRanges'
import type { FinanceExpense, InventoryPurchase } from '@prisma/client'
import { card, input as inputCls, label as labelCls, sectionHeading, mutedText, pillPrimary, pillOutline, selectOption } from '@/components/invoices/theme'

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d: Date | string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const CATEGORY_LABEL: Record<string, string> = {
  SHIPPING_POSTAGE: 'Shipping & Postage',
  PACKAGING_FULFILLMENT: 'Packaging & Fulfillment',
  INVENTORY_PRODUCT_PURCHASES: 'Inventory / Product Purchases',
  RESEARCH_FULFILLMENT_SUPPLIES: 'Research / Fulfillment Supplies',
  PAYMENT_PROCESSING: 'Payment Processing',
  SOFTWARE_TECHNOLOGY: 'Software & Technology',
  ADMINISTRATIVE_COMPLIANCE: 'Administrative & Compliance',
  PROFESSIONAL_SERVICES: 'Professional Services',
  ADVERTISING_MARKETING: 'Advertising & Marketing',
  OFFICE_SUPPLIES: 'Office Supplies',
  EQUIPMENT_ASSETS: 'Equipment / Assets',
  PHILANTHROPY_DONATIONS: 'Philanthropy / Donations',
  OTHER_NEEDS_REVIEW: 'Other / Needs Review',
}
const TREATMENT_LABEL: Record<string, string> = {
  OPERATING_EXPENSE: 'Operating Expense',
  INVENTORY_COGS: 'Inventory / COGS',
  CONTRA_REVENUE: 'Contra Revenue',
  ASSET_CAPITAL_EXPENSE: 'Asset / Capital Expense',
  CHARITABLE_SEPARATE_TREATMENT: 'Charitable / Separate Treatment',
  NEEDS_ACCOUNTANT_REVIEW: 'Needs Accountant Review',
}

type Tab = 'DASHBOARD' | 'EXPENSES' | 'DISCOUNTS' | 'INVENTORY' | 'REFUNDS' | 'VENDORS'
const TABS: { key: Tab; label: string }[] = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'EXPENSES', label: 'Expense Ledger' },
  { key: 'DISCOUNTS', label: 'Discounts & Credits' },
  { key: 'INVENTORY', label: 'Inventory / COGS' },
  { key: 'REFUNDS', label: 'Refunds' },
  { key: 'VENDORS', label: 'Vendors' },
]

interface Props {
  range: ResolvedFinanceRange
  metrics: FinanceDashboardMetrics
  expenses: FinanceExpense[]
  discounts: DiscountCreditRow[]
  refunds: RefundReportRow[]
  losses: InventoryLossRow[]
  purchases: (InventoryPurchase & { product: { name: string; size: string } })[]
  vendors: VendorReportRow[]
  products: { id: string; name: string; size: string }[]
  prefill?: ExpensePrefill
}

function RangePicker({ range }: { range: ResolvedFinanceRange }) {
  const router = useRouter()
  const pathname = usePathname()
  const [customFrom, setCustomFrom] = useState(range.from.toISOString().slice(0, 10))
  const [customTo, setCustomTo] = useState(range.to.toISOString().slice(0, 10))

  function go(key: FinanceRangeKey, from?: string, to?: string) {
    const params = new URLSearchParams({ range: key })
    if (key === 'CUSTOM' && from && to) {
      params.set('from', from)
      params.set('to', to)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(['THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'THIS_YEAR'] as FinanceRangeKey[]).map((key) => (
        <button
          key={key}
          onClick={() => go(key)}
          className={`text-[12px] font-heading font-bold uppercase tracking-wide px-3 py-2 rounded-lg transition-colors ${
            range.key === key ? 'bg-gold text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          {key.replace('THIS_', '').replace('_', ' ')}
        </button>
      ))}
      <div className="flex items-center gap-1.5">
        <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={`${inputCls} w-[140px] py-1.5`} />
        <span className={mutedText}>to</span>
        <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={`${inputCls} w-[140px] py-1.5`} />
        <button onClick={() => go('CUSTOM', customFrom, customTo)} className={`${pillOutline} px-3 py-2 text-[12px]`}>
          Apply
        </button>
      </div>
    </div>
  )
}

interface ExpensePrefill {
  category?: string
  invoiceId?: string
}

function AddExpenseForm({ products, onDone, prefill }: { products: { id: string; name: string; size: string }[]; onDone: () => void; prefill?: ExpensePrefill }) {
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [vendor, setVendor] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(prefill?.category && prefill.category in CATEGORY_LABEL ? prefill.category : 'OTHER_NEEDS_REVIEW')
  const [invoiceId, setInvoiceId] = useState(prefill?.invoiceId ?? '')
  const [subcategory, setSubcategory] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [businessPurpose, setBusinessPurpose] = useState('')
  const [taxTreatment, setTaxTreatment] = useState('NEEDS_ACCOUNTANT_REVIEW')
  const [productId, setProductId] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, vendor: vendor || null, description, amount: Number(amount), category, subcategory: subcategory || null,
          paymentMethod: paymentMethod || null, businessPurpose: businessPurpose || null, taxTreatment,
          productId: productId || null, invoiceId: invoiceId || null, receiptUrl: receiptUrl || null, notes: notes || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save expense')
      }
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4`}>
      <div className="md:col-span-3 flex items-center justify-between">
        <h3 className={sectionHeading}>Add Expense</h3>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
      <label className="block"><span className={labelCls}>Date</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Vendor</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Amazon, USPS…" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Amount</span><input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Description</span><input required value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Subcategory</span><input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="optional" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Tax Treatment</span>
        <select value={taxTreatment} onChange={(e) => setTaxTreatment(e.target.value)} className={inputCls}>
          {Object.entries(TREATMENT_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Payment Method</span><input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Business card, ACH…" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Related Product</span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
          <option value="" className={selectOption}>— none —</option>
          {products.map((p) => <option key={p.id} value={p.id} className={selectOption}>{p.name} ({p.size})</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Receipt URL</span><input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://…" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Invoice ID</span><input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="optional" className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Business Purpose</span><input value={businessPurpose} onChange={(e) => setBusinessPurpose(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save Expense'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

function MetricCard({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">{label}</p>
      <p className={`text-2xl font-heading font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  )
}

export function FinanceView({ range, metrics, expenses, discounts, refunds, losses, purchases, vendors, products, prefill }: Props) {
  const [tab, setTab] = useState<Tab>('DASHBOARD')
  const [showAddExpense, setShowAddExpense] = useState(Boolean(prefill))

  const exportHref = (format: 'xlsx' | 'csv') =>
    `/api/admin/finance/export?from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}&format=${format}`

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Finance</h1>
            <p className={`${mutedText} text-sm mt-0.5`}>Operational recordkeeping to support bookkeeping/tax prep — not a substitute for a CPA/accountant.</p>
          </div>
          <Link href="/admin" className="font-heading text-[12px] font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
            ← Admin Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 my-5">
          <RangePicker range={range} />
          <div className="flex items-center gap-2">
            <a href={exportHref('xlsx')} className={`${pillOutline} px-4 py-2 text-[12px]`}>Export Excel</a>
            <a href={exportHref('csv')} className={`${pillOutline} px-4 py-2 text-[12px]`}>Export CSV</a>
            <button onClick={() => setShowAddExpense((s) => !s)} className={`${pillPrimary} px-4 py-2 text-[12px]`}>+ Add Expense</button>
          </div>
        </div>

        {showAddExpense && <AddExpenseForm products={products} onDone={() => setShowAddExpense(false)} prefill={prefill} />}

        <div className="flex items-center gap-1 mb-6 border-b border-white/10 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[12px] font-heading font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key ? 'text-gold border-gold' : 'text-white/50 border-transparent hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'DASHBOARD' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Gross Revenue" value={money(metrics.grossRevenue)} />
            <MetricCard label="Discounts & Credits" value={money(metrics.discountsCredits)} />
            <MetricCard label="Net Revenue" value={money(metrics.netRevenue)} tone="text-gold" />
            <MetricCard label="COGS" value={money(metrics.cogs)} />
            <MetricCard label="Shipping Expense" value={money(metrics.shippingExpense)} />
            <MetricCard label="Payment Fees" value={money(metrics.paymentProcessingFees)} />
            <MetricCard label="Operating Expenses" value={money(metrics.operatingExpenses)} />
            <MetricCard label="Refunds" value={money(metrics.refunds)} />
            <MetricCard label="Estimated Gross Margin" value={money(metrics.estimatedGrossMargin)} tone={metrics.estimatedGrossMargin >= 0 ? 'text-green-400' : 'text-red-400'} />
            <MetricCard label="Expenses Needing Review" value={String(metrics.expensesNeedingReview)} tone="text-amber-400" />
            <div className={`${card} p-5 col-span-2`}>
              <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50">COGS Coverage</p>
              <p className="text-lg font-heading font-bold text-white mt-1">
                {metrics.cogsCoverage.itemsWithCost} of {metrics.cogsCoverage.itemsTotal} line items have a recorded cost
              </p>
              <p className={`${mutedText} text-[12px] mt-1`}>Invoice-line COGS tracking is new (2026-08-12) — historical coverage will be low until costs are recorded going forward.</p>
            </div>
          </div>
        )}

        {tab === 'EXPENSES' && (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/10">{['Date', 'Vendor', 'Description', 'Category', 'Amount', 'Treatment', 'Invoice #'].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-white/10">
                    <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-white">{e.vendor ?? '—'}</td>
                    <td className="px-4 py-3 text-white/70">{e.description}</td>
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">{CATEGORY_LABEL[e.category]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white font-semibold">{money(e.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/50 text-[12px]">{TREATMENT_LABEL[e.taxTreatment]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/50">{e.invoiceId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expenses.length === 0 && <div className="text-center py-16 text-white/50">No expenses recorded in this range.</div>}
          </div>
        )}

        {tab === 'DISCOUNTS' && (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/10">{['Date', 'Invoice #', 'Customer', 'Label', 'Source', 'Applied Amount'].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr></thead>
              <tbody>
                {discounts.map((d) => (
                  <tr key={d.id} className="border-b border-white/10">
                    <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(d.issuedAt)}</td>
                    <td className="px-4 py-3 text-white">{d.invoiceNumber}</td>
                    <td className="px-4 py-3 text-white/70">{d.customerName}</td>
                    <td className="px-4 py-3 text-white/70">{d.label}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{d.source.replace('_', ' ')}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white font-semibold">{money(d.appliedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {discounts.length === 0 && <div className="text-center py-16 text-white/50">No discounts or credits in this range.</div>}
          </div>
        )}

        {tab === 'INVENTORY' && (
          <div className="space-y-6">
            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4"><h3 className={sectionHeading}>Purchases (COGS)</h3></div>
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Date', 'Product', 'Qty', 'Unit Cost', 'Total', 'Supplier'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-white/10">
                      <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(p.receivedAt)}</td>
                      <td className="px-4 py-3 text-white">{p.product.name} <span className="text-white/40">({p.product.size})</span></td>
                      <td className="px-4 py-3 text-white/70">{p.quantity}</td>
                      <td className="px-4 py-3 text-white/70">{money(p.unitCost)}</td>
                      <td className="px-4 py-3 text-white font-semibold">{money(p.totalCost)}</td>
                      <td className="px-4 py-3 text-white/50">{p.supplier ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {purchases.length === 0 && <div className="text-center py-10 text-white/50">No inventory purchases recorded in this range.</div>}
            </div>
            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4"><h3 className={sectionHeading}>Loss / Shrinkage</h3></div>
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Date', 'Product', 'Qty', 'Cost Basis', 'Reason'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {losses.map((l) => (
                    <tr key={l.id} className="border-b border-white/10">
                      <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(l.createdAt)}</td>
                      <td className="px-4 py-3 text-white">{l.productName} <span className="text-white/40">({l.productSize})</span></td>
                      <td className="px-4 py-3 text-white/70">{l.quantity}</td>
                      <td className="px-4 py-3 text-white/70">{l.costBasis !== null ? money(l.costBasis) : 'Unknown'}</td>
                      <td className="px-4 py-3 text-white/50">{l.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {losses.length === 0 && <div className="text-center py-10 text-white/50">No inventory loss/shrinkage recorded in this range.</div>}
            </div>
          </div>
        )}

        {tab === 'REFUNDS' && (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/10">{['Completed', 'Invoice #', 'Customer', 'Amount', 'Reason'].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr></thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-white/10">
                    <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(r.completedAt)}</td>
                    <td className="px-4 py-3 text-white">{r.invoiceNumber}</td>
                    <td className="px-4 py-3 text-white/70">{r.customerName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white font-semibold">{money(r.completedAmount)}</td>
                    <td className="px-4 py-3 text-white/50">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {refunds.length === 0 && <div className="text-center py-16 text-white/50">No completed refunds in this range.</div>}
          </div>
        )}

        {tab === 'VENDORS' && (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-white/10">{['Vendor', 'Expense Count', 'Total Amount'].map((h) => (
                <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
              ))}</tr></thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.vendor} className="border-b border-white/10">
                    <td className="px-4 py-3 text-white">{v.vendor}</td>
                    <td className="px-4 py-3 text-white/70">{v.expenseCount}</td>
                    <td className="px-4 py-3 text-white font-semibold">{money(v.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vendors.length === 0 && <div className="text-center py-16 text-white/50">No vendor expenses in this range.</div>}
          </div>
        )}
      </div>
    </main>
  )
}
