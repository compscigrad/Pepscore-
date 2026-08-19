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
import type { FinanceExpense, InventoryPurchase, OwnerTransaction, BusinessTaxProfile, TaxReminder, MonthlyClose } from '@prisma/client'
import type { SalesTaxSummary } from '@/lib/finance/salesTax'
import type { StripeReconciliationRow, StripeReconciliationSummary } from '@/lib/finance/stripeReconciliation'
import type { ProfitLossReport } from '@/lib/finance/profitLoss'
import type { MonthlySummaryRow } from '@/lib/finance/monthlySummary'
import type { OwnerTransactionSummary } from '@/lib/finance/ownerTransactions'
import type { Vendor1099WithPayments } from '@/lib/finance/vendors1099'
import type { Form1099KReconciliationReport } from '@/lib/finance/form1099k'
import type { DataQualityFlag } from '@/lib/finance/dataQualityFlags'
import type { EstimatedTaxPlan } from '@/lib/finance/estimatedTax'
import { card, input as inputCls, label as labelCls, sectionHeading, mutedText, pillPrimary, pillOutline, selectOption } from '@/components/invoices/theme'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

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

type Tab = 'DASHBOARD' | 'EXPENSES' | 'DISCOUNTS' | 'INVENTORY' | 'REFUNDS' | 'VENDORS' | 'REPORTS' | 'RECONCILIATION' | 'OWNER' | 'TAX_CENTER' | 'VENDORS_1099'
const TABS: { key: Tab; label: string }[] = [
  { key: 'DASHBOARD', label: 'Dashboard' },
  { key: 'REPORTS', label: 'P&L / Sales Tax' },
  { key: 'EXPENSES', label: 'Expense Ledger' },
  { key: 'DISCOUNTS', label: 'Discounts & Credits' },
  { key: 'INVENTORY', label: 'Inventory / COGS' },
  { key: 'REFUNDS', label: 'Refunds' },
  { key: 'VENDORS', label: 'Vendors' },
  { key: 'RECONCILIATION', label: 'Reconciliation' },
  { key: 'OWNER', label: 'Owner Transactions' },
  { key: 'TAX_CENTER', label: 'Tax Center' },
  { key: 'VENDORS_1099', label: 'Vendor 1099s' },
]

interface Props {
  range: ResolvedFinanceRange
  taxYear: number
  metrics: FinanceDashboardMetrics
  expenses: FinanceExpense[]
  discounts: DiscountCreditRow[]
  refunds: RefundReportRow[]
  losses: InventoryLossRow[]
  purchases: (InventoryPurchase & { product: { name: string; size: string } })[]
  vendors: VendorReportRow[]
  products: { id: string; name: string; size: string }[]
  salesTax: SalesTaxSummary
  stripeReconciliation: StripeReconciliationRow[]
  stripeReconciliationSummary: StripeReconciliationSummary
  profitLoss: ProfitLossReport
  monthlySummary: MonthlySummaryRow[]
  ownerTransactions: OwnerTransaction[]
  ownerTransactionSummary: OwnerTransactionSummary
  taxProfile: BusinessTaxProfile | null
  missingProfileFields: string[]
  taxReminders: TaxReminder[]
  vendors1099: Vendor1099WithPayments[]
  form1099k: Form1099KReconciliationReport
  dataQualityFlags: DataQualityFlag[]
  monthlyCloses: MonthlyClose[]
  estimatedTaxPlan: EstimatedTaxPlan
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
      {(['TODAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'THIS_YEAR', 'LAST_YEAR'] as FinanceRangeKey[]).map((key) => (
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
  const [recurring, setRecurring] = useState(false)
  const [taxYear, setTaxYear] = useState('')
  const [reconciliationStatus, setReconciliationStatus] = useState('UNRECONCILED')
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
          recurring, taxYear: taxYear ? Number(taxYear) : null, reconciliationStatus,
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
      <label className="block"><span className={labelCls}>Tax Year</span><input type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} placeholder={`defaults to date's year`} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Reconciliation Status</span>
        <select value={reconciliationStatus} onChange={(e) => setReconciliationStatus(e.target.value)} className={inputCls}>
          <option value="UNRECONCILED" className={selectOption}>Unreconciled</option>
          <option value="RECONCILED" className={selectOption}>Reconciled</option>
        </select>
      </label>
      <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /><span className={labelCls}>Recurring expense</span></label>
      <label className="block md:col-span-3"><span className={labelCls}>Business Purpose</span><input value={businessPurpose} onChange={(e) => setBusinessPurpose(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save Expense'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

const OWNER_TX_LABEL: Record<string, string> = {
  CONTRIBUTION: 'Owner Contribution',
  DISTRIBUTION: 'Owner Distribution / Draw',
  REIMBURSEMENT: 'Owner Reimbursement',
  OWNER_PAID_EXPENSE: 'Owner-Paid Business Expense',
}

function AddOwnerTransactionForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [type, setType] = useState('CONTRIBUTION')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/owner-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date, amount: Number(amount), description, sourceReference: sourceReference || null, notes: notes || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save')
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4`}>
      <div className="md:col-span-3 flex items-center justify-between">
        <h3 className={sectionHeading}>Record Owner Transaction</h3>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
      <label className="block"><span className={labelCls}>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {Object.entries(OWNER_TX_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Date</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Amount</span><input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Description</span><input required value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Source Reference</span><input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} placeholder="bank transfer ref, check #…" className={inputCls} /></label>
      <label className="block md:col-span-2"><span className={labelCls}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

const REMINDER_TYPE_LABEL: Record<string, string> = {
  FEDERAL_ESTIMATED_TAX: 'Federal Estimated Tax',
  DC_ESTIMATED_TAX: 'DC Estimated Tax',
  ANNUAL_FEDERAL_FILING: 'Annual Federal Filing',
  DC_FILING: 'DC Filing',
  SALES_TAX_FILING: 'Sales Tax Filing',
  CONTRACTOR_1099_REPORTING: 'Contractor / 1099 Reporting',
  BUSINESS_REGISTRATION_RENEWAL: 'Business Registration Renewal',
  OTHER: 'Other',
}

function AddTaxReminderForm({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [reminderType, setReminderType] = useState('FEDERAL_ESTIMATED_TAX')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/tax-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderType, dueDate: dueDate || null, notes: notes || null, status: dueDate ? 'UPCOMING' : 'NOT_CONFIGURED' }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save')
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4`}>
      <div className="md:col-span-3 flex items-center justify-between">
        <h3 className={sectionHeading}>Add Tax Reminder</h3>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
      <label className="block"><span className={labelCls}>Reminder Type</span>
        <select value={reminderType} onChange={(e) => setReminderType(e.target.value)} className={inputCls}>
          {Object.entries(REMINDER_TYPE_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Due Date (optional)</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

function AddVendor1099Form({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const [vendorName, setVendorName] = useState('')
  const [payeeType, setPayeeType] = useState('UNKNOWN')
  const [w9Received, setW9Received] = useState(false)
  const [tinLast4, setTinLast4] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/vendors-1099', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorName, payeeType, w9Received, tinLast4: tinLast4 || null, notes: notes || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save')
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4`}>
      <div className="md:col-span-3 flex items-center justify-between">
        <h3 className={sectionHeading}>Add Vendor</h3>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
      <label className="block md:col-span-2"><span className={labelCls}>Vendor Name</span><input required value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Payee Type</span>
        <select value={payeeType} onChange={(e) => setPayeeType(e.target.value)} className={inputCls}>
          <option value="UNKNOWN" className={selectOption}>Unknown</option>
          <option value="BUSINESS" className={selectOption}>Business</option>
          <option value="INDIVIDUAL" className={selectOption}>Individual</option>
        </select>
      </label>
      <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={w9Received} onChange={(e) => setW9Received(e.target.checked)} /><span className={labelCls}>W-9 Received</span></label>
      <label className="block"><span className={labelCls}>TIN — last 4 digits only</span><input value={tinLast4} onChange={(e) => setTinLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234" maxLength={4} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  UNKNOWN: 'Unknown / Not Set',
  SOLE_PROPRIETORSHIP: 'Sole Proprietorship',
  SINGLE_MEMBER_LLC: 'Single-Member LLC / Disregarded Entity',
  MULTI_MEMBER_LLC_PARTNERSHIP: 'Multi-Member LLC / Partnership',
  S_CORPORATION: 'S Corporation',
  C_CORPORATION: 'C Corporation',
  OTHER_CPA_DETERMINED: 'Other / CPA Determined',
}
const ACCOUNTING_METHOD_LABEL: Record<string, string> = { UNKNOWN: 'Unknown / Not Set', CASH: 'Cash', ACCRUAL: 'Accrual' }

function EditTaxProfileForm({ profile, onDone }: { profile: BusinessTaxProfile | null; onDone: () => void }) {
  const router = useRouter()
  const [legalBusinessName, setLegalBusinessName] = useState(profile?.legalBusinessName ?? '')
  const [dba, setDba] = useState(profile?.dba ?? '')
  const [ein, setEin] = useState(profile?.ein ?? '')
  const [stateOfFormation, setStateOfFormation] = useState(profile?.stateOfFormation ?? '')
  const [entityType, setEntityType] = useState(profile?.entityType ?? 'UNKNOWN')
  const [accountingMethod, setAccountingMethod] = useState(profile?.accountingMethod ?? 'UNKNOWN')
  const [federalTaxClassification, setFederalTaxClassification] = useState(profile?.federalTaxClassification ?? '')
  const [salesTaxRegistrations, setSalesTaxRegistrations] = useState(profile?.salesTaxRegistrations ?? '')
  const [estimatedTaxRatePercent, setEstimatedTaxRatePercent] = useState(profile?.estimatedTaxRatePercent?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/tax-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalBusinessName: legalBusinessName || null, dba: dba || null, ein: ein || null, stateOfFormation: stateOfFormation || null,
          entityType, accountingMethod, federalTaxClassification: federalTaxClassification || null, salesTaxRegistrations: salesTaxRegistrations || null,
          estimatedTaxRatePercent: estimatedTaxRatePercent ? Number(estimatedTaxRatePercent) : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save')
      router.refresh()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4`}>
      <div className="md:col-span-3 flex items-center justify-between">
        <h3 className={sectionHeading}>Business Tax Profile</h3>
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
      <label className="block"><span className={labelCls}>Legal Business Name</span><input value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>DBA</span><input value={dba} onChange={(e) => setDba(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>EIN</span><input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="00-0000000" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>State of Formation</span><input value={stateOfFormation} onChange={(e) => setStateOfFormation(e.target.value)} placeholder="e.g. DC" className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Entity Type</span>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value as BusinessTaxProfile['entityType'])} className={inputCls}>
          {Object.entries(ENTITY_TYPE_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block"><span className={labelCls}>Accounting Method</span>
        <select value={accountingMethod} onChange={(e) => setAccountingMethod(e.target.value as BusinessTaxProfile['accountingMethod'])} className={inputCls}>
          {Object.entries(ACCOUNTING_METHOD_LABEL).map(([k, v]) => <option key={k} value={k} className={selectOption}>{v}</option>)}
        </select>
      </label>
      <label className="block md:col-span-3"><span className={labelCls}>Federal Tax Classification (free text — varies too much to fix as a list)</span><input value={federalTaxClassification} onChange={(e) => setFederalTaxClassification(e.target.value)} className={inputCls} /></label>
      <label className="block md:col-span-3"><span className={labelCls}>Sales Tax Registrations (free text — e.g. &ldquo;DC&rdquo;)</span><input value={salesTaxRegistrations} onChange={(e) => setSalesTaxRegistrations(e.target.value)} className={inputCls} /></label>
      <label className="block"><span className={labelCls}>Estimated Tax Rate % (optional, for Estimated Tax Planning below — a flat combined rate you supply, never computed or suggested by this system)</span><input type="number" step="0.1" min="0" max="100" value={estimatedTaxRatePercent} onChange={(e) => setEstimatedTaxRatePercent(e.target.value)} placeholder="e.g. 25" className={inputCls} /></label>
      <div className="md:col-span-3 flex items-center gap-3">
        <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onDone} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
      </div>
    </form>
  )
}

function Form1099K({ record }: { record: Form1099KReconciliationReport }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [processorGross, setProcessorGross] = useState(record.processorReportedGross?.toString() ?? '')
  const [notes, setNotes] = useState(record.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/finance/1099k', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxYear: record.taxYear, processorReportedGross: processorGross ? Number(processorGross) : null, notes: notes || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save')
      router.refresh()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {error && <span className="md:col-span-3 text-[12px] text-red-400">{error}</span>}
        <label className="block"><span className={labelCls}>Processor-Reported Gross (1099-K, when received)</span><input type="number" step="0.01" min="0" value={processorGross} onChange={(e) => setProcessorGross(e.target.value)} className={inputCls} /></label>
        <label className="block md:col-span-2"><span className={labelCls}>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></label>
        <div className="md:col-span-3 flex items-center gap-3">
          <button type="submit" disabled={busy} className={`${pillPrimary} px-5 py-2.5`}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} className={`${pillOutline} px-5 py-2.5`}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Processor-Reported Gross" value={record.processorReportedGross !== null ? money(record.processorReportedGross) : 'Not Entered'} />
        <MetricCard label="Book Gross" value={money(record.bookGross)} />
        <MetricCard label="Refunds" value={money(record.refunds)} />
        <MetricCard label="Fees" value={money(record.fees)} />
        <MetricCard label="Shipping" value={money(record.shipping)} />
        <MetricCard label="Tax" value={money(record.tax)} />
        <MetricCard label="Adjustments (Discounts)" value={money(record.adjustments)} />
        <MetricCard label="Difference" value={record.difference !== null ? money(record.difference) : '—'} tone={record.difference !== null && Math.abs(record.difference) > 1 ? 'text-amber-400' : 'text-white'} />
      </div>
      {record.notes && <p className={`${mutedText} text-[12px] mt-3`}>{record.notes}</p>}
      <button onClick={() => setEditing(true)} className={`${pillOutline} px-4 py-2 text-[12px] mt-4`}>{record.processorReportedGross !== null ? 'Update' : 'Enter Processor 1099-K Amount'}</button>
    </div>
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

export function FinanceView({
  range, taxYear, metrics, expenses, discounts, refunds, losses, purchases, vendors, products, prefill,
  salesTax, stripeReconciliation, stripeReconciliationSummary, profitLoss, monthlySummary,
  ownerTransactions, ownerTransactionSummary, taxProfile, missingProfileFields, taxReminders,
  vendors1099, form1099k, dataQualityFlags, monthlyCloses, estimatedTaxPlan,
}: Props) {
  const [tab, setTab] = useState<Tab>('DASHBOARD')
  const [showAddExpense, setShowAddExpense] = useState(Boolean(prefill))
  const [showAddOwnerTx, setShowAddOwnerTx] = useState(false)
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [showAddVendor1099, setShowAddVendor1099] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  const exportHref = (format: 'xlsx' | 'csv' | 'qbo') =>
    `/api/admin/finance/export?from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}&format=${format}`

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <AdminPageHeader
          title="Finance"
          subtitle="Operational recordkeeping to support bookkeeping/tax prep — not a substitute for a CPA/accountant."
          actions={
            <Link href="/admin" className="font-heading text-[12px] font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
              ← Admin Dashboard
            </Link>
          }
        />

        <div className="flex items-center justify-between flex-wrap gap-3 my-5">
          <RangePicker range={range} />
          <div className="flex items-center gap-2">
            <a href={exportHref('xlsx')} className={`${pillOutline} px-4 py-2 text-[12px]`}>Export Excel</a>
            <a href={exportHref('csv')} className={`${pillOutline} px-4 py-2 text-[12px]`}>Export CSV</a>
            <a href={exportHref('qbo')} className={`${pillOutline} px-4 py-2 text-[12px]`} title="Bank/transaction CSV importable via QuickBooks Online's or Xero's own 'Upload a statement' feature — no paid connection required">Export QuickBooks/Xero</a>
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
              <thead><tr className="border-b border-white/10">{['Date', 'Vendor', 'Description', 'Category', 'Amount', 'Treatment', 'Tax Year', 'Reconciled', 'Recurring', 'Invoice #'].map((h) => (
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
                    <td className="px-4 py-3 whitespace-nowrap text-white/50">{e.taxYear ?? new Date(e.date).getFullYear()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/50 text-[12px]">{e.reconciliationStatus === 'RECONCILED' ? 'Reconciled' : 'Unreconciled'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-white/50 text-[12px]">{e.recurring ? 'Yes' : '—'}</td>
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

        {tab === 'REPORTS' && (
          <div className="space-y-6">
            <div className={`${card} p-5`}>
              <p className="text-[11px] font-heading font-bold uppercase tracking-wide text-gold mb-1">Internal Management Report — Not a Filed Tax Return</p>
              <h3 className={sectionHeading}>Profit &amp; Loss</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <MetricCard label="Product Sales" value={money(profitLoss.revenue.productSales)} />
                <MetricCard label="Less Discounts" value={money(profitLoss.revenue.lessDiscounts)} />
                <MetricCard label="Less Refunds" value={money(profitLoss.revenue.lessRefunds)} />
                <MetricCard label="Net Revenue" value={money(profitLoss.revenue.netRevenue)} tone="text-gold" />
                <MetricCard label="COGS" value={money(profitLoss.cogs.total)} />
                <MetricCard label="Gross Profit" value={money(profitLoss.grossProfit)} tone={profitLoss.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
                <MetricCard label="Operating Expenses" value={money(profitLoss.operatingExpenses.total)} />
                <MetricCard label="Operating Profit" value={money(profitLoss.operatingProfit)} tone={profitLoss.operatingProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
              </div>
              <p className={`${mutedText} text-[12px] mt-4`}>
                Sales tax collected (${salesTax.totalTaxCollected.toFixed(2)}) is a pass-through liability, shown separately below — never included in revenue above.
                Book Profit / Estimated Operating Profit only — final taxable income is determined during tax preparation.
              </p>
            </div>

            <div className={`${card} p-5`}>
              <h3 className={sectionHeading}>Sales Tax Ledger</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <MetricCard label="Invoice Tax Collected" value={money(salesTax.invoiceTaxCollected)} />
                <MetricCard label="Order Tax Collected" value={money(salesTax.orderTaxCollected)} />
                <MetricCard label="Total Tax Collected" value={money(salesTax.totalTaxCollected)} tone="text-gold" />
                <MetricCard label="Net Tax Collected" value={money(salesTax.netTaxCollected)} />
              </div>
              <p className={`${mutedText} text-[12px] mt-3`}>
                No sales tax has been collected on any invoice or storefront order to date — this reports the real, current figure ($0), not an estimate. See docs/launch/SalesTaxDecision.md.
              </p>
            </div>

            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4"><h3 className={sectionHeading}>Monthly Summary — {taxYear}</h3></div>
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Month', 'Gross', 'Net', 'COGS', 'Opex', 'Refunds', 'Margin', 'Invoices'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {monthlySummary.map((m) => (
                    <tr key={m.month} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white">{m.monthLabel}</td>
                      <td className="px-4 py-3 text-white/70">{money(m.grossRevenue)}</td>
                      <td className="px-4 py-3 text-white font-semibold">{money(m.netRevenue)}</td>
                      <td className="px-4 py-3 text-white/70">{money(m.cogs)}</td>
                      <td className="px-4 py-3 text-white/70">{money(m.operatingExpenses)}</td>
                      <td className="px-4 py-3 text-white/70">{money(m.refunds)}</td>
                      <td className={`px-4 py-3 font-semibold ${m.estimatedGrossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money(m.estimatedGrossMargin)}</td>
                      <td className="px-4 py-3 text-white/50">{m.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'RECONCILIATION' && (
          <div className="space-y-6">
            <div className={`${card} p-5`}>
              <h3 className={sectionHeading}>Stripe Reconciliation</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <MetricCard label="Matched" value={String(stripeReconciliationSummary.matched)} tone="text-green-400" />
                <MetricCard label="Partial" value={String(stripeReconciliationSummary.partial)} tone="text-amber-400" />
                <MetricCard label="Mismatch" value={String(stripeReconciliationSummary.mismatch)} tone="text-red-400" />
                <MetricCard label="Pending" value={String(stripeReconciliationSummary.pending)} />
                <MetricCard label="Not Available" value={String(stripeReconciliationSummary.notAvailable)} />
              </div>
              {stripeReconciliation.length === 0 && (
                <p className={`${mutedText} text-[12px] mt-4`}>No storefront Stripe payments in this range yet — the current sales channel is direct/manual invoices, which don&apos;t carry per-transaction Stripe processor data. This report activates automatically once storefront checkout is live.</p>
              )}
            </div>
            {stripeReconciliation.length > 0 && (
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b border-white/10">{['Order #', 'Order Total', 'Stripe Gross', 'Fees', 'Fee Source', 'Refunded', 'Net Settlement', 'Payout', 'Status'].map((h) => (
                    <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {stripeReconciliation.map((r) => (
                      <tr key={r.orderId} className="border-b border-white/10">
                        <td className="px-4 py-3 text-white whitespace-nowrap">{r.orderNumber}</td>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">{money(r.orderTotal)}</td>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">{money(r.stripeGross)}</td>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">{money(r.stripeFees)}</td>
                        <td className={`px-4 py-3 text-[12px] whitespace-nowrap ${r.stripeFeeIsEstimated ? 'text-amber-400' : 'text-white/50'}`}>{r.stripeFeeIsEstimated ? 'Estimated' : 'Stripe (real)'}</td>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">{money(r.refundedAmount)}</td>
                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{money(r.netSettlement)}</td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap">{r.payoutId ?? '—'}</td>
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${r.status === 'MATCHED' ? 'text-green-400' : r.status === 'MISMATCH' ? 'text-red-400' : 'text-amber-400'}`}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4 flex items-center justify-between">
                <h3 className={sectionHeading}>Data Quality Flags</h3>
                <span className="text-[12px] text-white/50">{dataQualityFlags.length} flagged</span>
              </div>
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Type', 'Reference', 'Detail'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {dataQualityFlags.map((f, i) => (
                    <tr key={`${f.entityId}-${i}`} className="border-b border-white/10">
                      <td className="px-4 py-3 text-amber-400 whitespace-nowrap">{f.type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-white">{f.reference}</td>
                      <td className="px-4 py-3 text-white/60">{f.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dataQualityFlags.length === 0 && <div className="text-center py-10 text-white/50">No data-quality issues flagged.</div>}
            </div>

            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4"><h3 className={sectionHeading}>Monthly Close — {taxYear}</h3></div>
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Month', 'Status', 'Closed At'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {monthlyCloses.map((c) => (
                    <tr key={c.id} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white">{new Date(c.year, c.month - 1).toLocaleString('en-US', { month: 'long' })}</td>
                      <td className={`px-4 py-3 font-semibold ${c.closedAt ? 'text-green-400' : 'text-white/50'}`}>{c.closedAt ? 'Closed' : 'Open'}</td>
                      <td className="px-4 py-3 text-white/50">{c.closedAt ? fmtDate(c.closedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {monthlyCloses.length === 0 && <div className="text-center py-10 text-white/50">No months tracked yet this year — a close record is created the first time a month&apos;s checklist is touched.</div>}
            </div>
          </div>
        )}

        {tab === 'OWNER' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => setShowAddOwnerTx((s) => !s)} className={`${pillPrimary} px-4 py-2 text-[12px]`}>+ Record Owner Transaction</button>
            </div>
            {showAddOwnerTx && <AddOwnerTransactionForm onDone={() => setShowAddOwnerTx(false)} />}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Contributions" value={money(ownerTransactionSummary.contributions)} tone="text-green-400" />
              <MetricCard label="Distributions" value={money(ownerTransactionSummary.distributions)} tone="text-amber-400" />
              <MetricCard label="Reimbursements" value={money(ownerTransactionSummary.reimbursements)} />
              <MetricCard label="Owner-Paid Expenses" value={money(ownerTransactionSummary.ownerPaidExpenses)} />
            </div>
            <p className={`${mutedText} text-[12px]`}>Never counted as sales revenue, a customer refund, or a business expense — tracked separately here.</p>
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-white/10">{['Date', 'Type', 'Description', 'Amount', 'Source Ref', 'Notes'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {ownerTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-white/10">
                      <td className="px-4 py-3 whitespace-nowrap text-white/70">{fmtDate(t.date)}</td>
                      <td className="px-4 py-3 text-white whitespace-nowrap">{OWNER_TX_LABEL[t.type]}</td>
                      <td className="px-4 py-3 text-white/70">{t.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-white font-semibold">{money(t.amount)}</td>
                      <td className="px-4 py-3 text-white/50">{t.sourceReference ?? '—'}</td>
                      <td className="px-4 py-3 text-white/50">{t.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ownerTransactions.length === 0 && <div className="text-center py-16 text-white/50">No owner transactions recorded in this range.</div>}
            </div>
          </div>
        )}

        {tab === 'TAX_CENTER' && (
          <div className="space-y-6">
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between">
                <h3 className={sectionHeading}>Business Profile — Tax Year {taxYear}</h3>
                <button onClick={() => setShowEditProfile((s) => !s)} className={`${pillOutline} px-4 py-2 text-[12px]`}>{showEditProfile ? 'Cancel' : 'Edit'}</button>
              </div>
              {showEditProfile ? (
                <div className="mt-4"><EditTaxProfileForm profile={taxProfile} onDone={() => setShowEditProfile(false)} /></div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-[13px]">
                  <div><p className={labelCls}>Legal Name</p><p className="text-white">{taxProfile?.legalBusinessName ?? '— Not Set —'}</p></div>
                  <div><p className={labelCls}>EIN</p><p className="text-white">{taxProfile?.ein ?? '— Not Set —'}</p></div>
                  <div><p className={labelCls}>State of Formation</p><p className="text-white">{taxProfile?.stateOfFormation ?? '— Not Set —'}</p></div>
                  <div><p className={labelCls}>Entity Type</p><p className="text-white">{taxProfile ? ENTITY_TYPE_LABEL[taxProfile.entityType] : 'Unknown / Not Set'}</p></div>
                  <div><p className={labelCls}>Accounting Method</p><p className="text-white">{taxProfile ? ACCOUNTING_METHOD_LABEL[taxProfile.accountingMethod] : 'Unknown / Not Set'}</p></div>
                  <div><p className={labelCls}>Sales Tax Registrations</p><p className="text-white">{taxProfile?.salesTaxRegistrations ?? '— Not Set —'}</p></div>
                </div>
              )}
              {missingProfileFields.length > 0 && (
                <p className="text-[12px] text-amber-400 mt-4">Missing Information: {missingProfileFields.join(', ')}</p>
              )}
            </div>

            <div className={`${card} p-5`}>
              <h3 className={sectionHeading}>Year Summary — {taxYear}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <MetricCard label="Gross Receipts" value={money(profitLoss.revenue.productSales)} />
                <MetricCard label="Refunds" value={money(profitLoss.revenue.lessRefunds)} />
                <MetricCard label="Discounts" value={money(profitLoss.revenue.lessDiscounts)} />
                <MetricCard label="Net Sales" value={money(profitLoss.revenue.netRevenue)} tone="text-gold" />
                <MetricCard label="Sales Tax Collected" value={money(salesTax.totalTaxCollected)} />
                <MetricCard label="Processor Fees" value={money(profitLoss.operatingExpenses.paymentProcessing)} />
                <MetricCard label="COGS" value={money(profitLoss.cogs.total)} />
                <MetricCard label="Owner Contributions" value={money(ownerTransactionSummary.contributions)} />
                <MetricCard label="Owner Distributions" value={money(ownerTransactionSummary.distributions)} />
                <MetricCard label="Estimated Book Profit" value={money(profitLoss.operatingProfit)} tone={profitLoss.operatingProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
                <MetricCard label="Unreconciled Items" value={String(dataQualityFlags.length)} tone={dataQualityFlags.length > 0 ? 'text-amber-400' : 'text-white'} />
                <MetricCard label="Missing Information" value={String(missingProfileFields.length)} tone={missingProfileFields.length > 0 ? 'text-amber-400' : 'text-white'} />
              </div>
            </div>

            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4">
                <h3 className={sectionHeading}>Estimated Tax Planning — {taxYear}</h3>
                <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wide mt-1">Estimate only — not tax advice or a filing</p>
                <p className={`${mutedText} text-[12px] mt-1`}>{estimatedTaxPlan.disclaimer}</p>
              </div>
              {estimatedTaxPlan.ratePercent === null && (
                <p className="px-4 py-3 text-[12px] text-white/50">No estimated tax rate set — enter one in the Business Profile above to see estimated amounts. Quarterly Book Profit figures below are real regardless.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] mt-2">
                  <thead><tr className="border-b border-white/10">{['Quarter', 'Months', 'Book Profit', 'Informational Due Date', 'Estimated Tax'].map((h) => (
                    <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}</tr></thead>
                  <tbody>
                    {estimatedTaxPlan.quarters.map((q) => (
                      <tr key={q.quarter} className="border-b border-white/10">
                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{q.label}</td>
                        <td className="px-4 py-3 text-white/70 whitespace-nowrap">{q.monthsIncluded}</td>
                        <td className={`px-4 py-3 whitespace-nowrap font-semibold ${q.estimatedBookProfit >= 0 ? 'text-white' : 'text-red-400'}`}>{money(q.estimatedBookProfit)}</td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap">{q.informationalDueDate}</td>
                        <td className="px-4 py-3 text-gold font-semibold whitespace-nowrap">{q.estimatedTaxAmount !== null ? money(q.estimatedTaxAmount) : '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <td className="px-4 py-3 text-white font-bold whitespace-nowrap" colSpan={2}>Annual</td>
                      <td className={`px-4 py-3 font-bold whitespace-nowrap ${estimatedTaxPlan.annualEstimatedBookProfit >= 0 ? 'text-white' : 'text-red-400'}`}>{money(estimatedTaxPlan.annualEstimatedBookProfit)}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-gold font-bold whitespace-nowrap">{estimatedTaxPlan.annualEstimatedTaxAmount !== null ? money(estimatedTaxPlan.annualEstimatedTaxAmount) : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${card} p-5`}>
              <h3 className={sectionHeading}>1099-K Reconciliation — {taxYear}</h3>
              <Form1099K record={form1099k} />
            </div>

            <div className={`${card} overflow-x-auto`}>
              <div className="px-4 pt-4 flex items-center justify-between">
                <h3 className={sectionHeading}>Tax Reminders</h3>
                <button onClick={() => setShowAddReminder((s) => !s)} className={`${pillOutline} px-4 py-2 text-[12px]`}>{showAddReminder ? 'Cancel' : '+ Add Reminder'}</button>
              </div>
              {showAddReminder && <div className="px-4 pb-4"><AddTaxReminderForm onDone={() => setShowAddReminder(false)} /></div>}
              <table className="w-full text-[13px] mt-2">
                <thead><tr className="border-b border-white/10">{['Type', 'Due Date', 'Status', 'CPA Confirmed', 'Notes'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {taxReminders.map((r) => (
                    <tr key={r.id} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white whitespace-nowrap">{REMINDER_TYPE_LABEL[r.reminderType]}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                      <td className={`px-4 py-3 font-semibold ${r.status === 'OVERDUE' ? 'text-red-400' : r.status === 'COMPLETED' ? 'text-green-400' : r.status === 'UPCOMING' ? 'text-amber-400' : 'text-white/50'}`}>{r.status.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-white/50">{r.ownerCpaConfirmed ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-white/50">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {taxReminders.length === 0 && <div className="text-center py-10 text-white/50">No reminders configured yet.</div>}
            </div>
          </div>
        )}

        {tab === 'VENDORS_1099' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => setShowAddVendor1099((s) => !s)} className={`${pillPrimary} px-4 py-2 text-[12px]`}>{showAddVendor1099 ? 'Cancel' : '+ Add Vendor'}</button>
            </div>
            {showAddVendor1099 && <AddVendor1099Form onDone={() => setShowAddVendor1099(false)} />}
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-white/10">{['Vendor', 'Type', 'W-9', 'TIN (last 4)', `Payments ${taxYear}`, 'Review Status', 'Notes'].map((h) => (
                  <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">{h}</th>
                ))}</tr></thead>
                <tbody>
                  {vendors1099.map((v) => (
                    <tr key={v.id} className="border-b border-white/10">
                      <td className="px-4 py-3 text-white">{v.vendorName}</td>
                      <td className="px-4 py-3 text-white/60">{v.payeeType}</td>
                      <td className={`px-4 py-3 font-semibold ${v.w9Received ? 'text-green-400' : 'text-red-400'}`}>{v.w9Received ? 'Received' : 'Missing'}</td>
                      <td className="px-4 py-3 text-white/50">{v.tinLast4 ? `••••${v.tinLast4}` : '—'}</td>
                      <td className="px-4 py-3 text-white font-semibold">{money(v.paymentsYtd)}</td>
                      <td className="px-4 py-3 text-white/50">{v.reviewStatus.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-white/50">{v.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendors1099.length === 0 && <div className="text-center py-16 text-white/50">No 1099 vendors tracked yet.</div>}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
