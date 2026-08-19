// Admin Customers / Leads CRM list (Phase 2B item 8) -- search, filter,
// sort over lib/customers.ts's listCustomers(), which had zero callers
// before this page. Server-rendered, filters/sort/pagination driven by
// URL search params so the view is bookmarkable/shareable and needs no
// client-side data fetching.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { listCustomers, type ListCustomersParams } from '@/lib/customers'
import { formatPhoneDisplay } from '@/lib/invoice/format'
import { LeadStatusBadge, type LeadStatusValue } from '@/components/admin/CustomerLeadStatusControl'
import { AdminCustomerSearch } from '@/components/admin/AdminCustomerSearch'
import { computePortalAdoptionOverview, type PortalAdoptionStatus } from '@/lib/portal/adoptionStatus'
import { PORTAL_ADOPTION_STATUS_LABEL, PORTAL_ADOPTION_STATUS_STYLE, PORTAL_ADOPTION_STATUS_VALUES } from '@/lib/portal/adoptionStatusDisplay'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

interface PageProps {
  searchParams: Promise<{
    search?: string
    status?: string
    leadStatus?: string
    interestType?: string
    consent?: string
    campaign?: string
    portalStatus?: string
    sortBy?: string
    page?: string
  }>
}

const CUSTOMER_STATUSES = [
  'LEAD', 'INTAKE_SENT', 'INTAKE_COMPLETED', 'AWAITING_FULFILLMENT', 'INVOICE_ISSUED', 'AWAITING_PAYMENT',
  'PARTIALLY_PAID', 'PAYMENT_ARRANGEMENT', 'PAID', 'ELIGIBLE_FOR_FULFILLMENT', 'LABEL_CREATED',
  'PREPARING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'ARCHIVED',
] as const

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED'] as const

const INTEREST_TYPES = [
  'GENERAL_UPDATES', 'LAUNCH_NOTIFICATION', 'PRODUCT_INTEREST', 'NOTIFY_WHEN_AVAILABLE',
  'OUT_OF_STOCK_INTEREST', 'PRICING_REVIEW_INTEREST', 'SPA_WHOLESALE_INQUIRY', 'FIRST_ORDER_OFFER',
] as const

const INTEREST_TYPE_LABEL: Record<string, string> = {
  GENERAL_UPDATES: 'General Updates',
  LAUNCH_NOTIFICATION: 'Launch Notification',
  PRODUCT_INTEREST: 'Product Interest',
  NOTIFY_WHEN_AVAILABLE: 'Notify When Available',
  OUT_OF_STOCK_INTEREST: 'Out of Stock Interest',
  PRICING_REVIEW_INTEREST: 'Pricing Review Interest',
  SPA_WHOLESALE_INQUIRY: 'SPA / Wholesale Inquiry',
  FIRST_ORDER_OFFER: 'First-Order Offer',
}

function formatLabel(value: string): string {
  return value.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/admin/customers')
  if (!(await isCurrentUserAdmin())) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 max-w-md text-center">
          <h1 className="font-heading text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/50 text-sm">This account isn&apos;t authorized to view the admin dashboard.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const limit = 25

  // Portal Status is derived (computePortalAdoptionOverview()), not a
  // stored Customer column, so it can't join the Prisma `where` the way
  // status/leadStatus do -- resolve it to a concrete id set first, then
  // hand that to listCustomers()'s generic customerIds filter so DB-level
  // pagination still stays correct for everyone, filtered or not.
  const portalStatus = (sp.portalStatus as PortalAdoptionStatus) || undefined
  const portalAdoption = await computePortalAdoptionOverview()
  const portalStatusCustomerIds = portalStatus ? portalAdoption.entries.filter((e) => e.status === portalStatus).map((e) => e.customerId) : undefined

  const params: ListCustomersParams = {
    search: sp.search || undefined,
    status: (sp.status as ListCustomersParams['status']) || undefined,
    leadStatus: (sp.leadStatus as ListCustomersParams['leadStatus']) || undefined,
    interestType: (sp.interestType as ListCustomersParams['interestType']) || undefined,
    hasConsent: sp.consent === 'yes' ? true : sp.consent === 'no' ? false : undefined,
    campaign: sp.campaign || undefined,
    customerIds: portalStatusCustomerIds,
    sortBy: (sp.sortBy as ListCustomersParams['sortBy']) || 'newest',
    page,
    limit,
  }

  const { customers, total } = await listCustomers(params)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const baseQuery = { search: sp.search, status: sp.status, leadStatus: sp.leadStatus, interestType: sp.interestType, consent: sp.consent, campaign: sp.campaign, portalStatus: sp.portalStatus, sortBy: sp.sortBy }

  return (
    <main className="min-h-screen bg-black p-6 md:p-8">
      <div className="max-w-[1400px] mx-auto">
        <AdminPageHeader
          title="Customers & Leads"
          subtitle={`${total} record${total === 1 ? '' : 's'}`}
          actions={
            <>
              <Link href="/admin/customers/portal-invite" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                Bulk Portal Invite →
              </Link>
              <Link href="/admin" className="text-[12px] font-heading font-bold text-gold hover:text-gold-dark uppercase tracking-[0.06em]">
                ← Admin Dashboard
              </Link>
            </>
          }
        />

        {/* Quick jump -- predictive lookup for "I know who I'm looking
            for" (2026-08-17), distinct from the URL-driven filter form
            below it for "show me customers matching these criteria". The
            two solve different workflows and both stay. */}
        <div className="mb-4 max-w-md">
          <AdminCustomerSearch />
        </div>

        {/* Filters -- a plain GET form so the whole view stays URL-driven,
            bookmarkable, and needs no client JS for the common case. */}
        <form className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5 mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div className="col-span-2 md:col-span-2">
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Search</label>
            <input
              name="search"
              defaultValue={sp.search}
              placeholder="Name, email, phone, company…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Lead Status</label>
            <select name="leadStatus" defaultValue={sp.leadStatus ?? ''} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="" className="bg-white text-dark">All</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s} className="bg-white text-dark">{formatLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Customer Status</label>
            <select name="status" defaultValue={sp.status ?? ''} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="" className="bg-white text-dark">All</option>
              {CUSTOMER_STATUSES.map((s) => <option key={s} value={s} className="bg-white text-dark">{formatLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Interest</label>
            <select name="interestType" defaultValue={sp.interestType ?? ''} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="" className="bg-white text-dark">All</option>
              {INTEREST_TYPES.map((t) => <option key={t} value={t} className="bg-white text-dark">{INTEREST_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Consent</label>
            <select name="consent" defaultValue={sp.consent ?? ''} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="" className="bg-white text-dark">All</option>
              <option value="yes" className="bg-white text-dark">Consented</option>
              <option value="no" className="bg-white text-dark">Not consented</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Portal Status</label>
            <select name="portalStatus" defaultValue={sp.portalStatus ?? ''} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="" className="bg-white text-dark">All</option>
              {PORTAL_ADOPTION_STATUS_VALUES.map((s) => <option key={s} value={s} className="bg-white text-dark">{PORTAL_ADOPTION_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Campaign / Source</label>
            <input
              name="campaign"
              defaultValue={sp.campaign}
              placeholder="e.g. google, spring26"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 mb-1.5">Sort</label>
            <select name="sortBy" defaultValue={sp.sortBy ?? 'newest'} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30">
              <option value="newest" className="bg-white text-dark">Newest</option>
              <option value="oldest" className="bg-white text-dark">Oldest</option>
              <option value="name" className="bg-white text-dark">Name A–Z</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1 flex gap-2">
            <button type="submit" className="rounded-lg bg-gold hover:bg-gold-dark px-4 py-2 text-[13px] font-heading font-bold text-white transition-colors">
              Apply
            </button>
            <Link href="/admin/customers" className="rounded-lg border border-white/10 px-4 py-2 text-[13px] font-heading font-bold text-white/70 hover:bg-white/5 transition-colors">
              Clear
            </Link>
          </div>
        </form>

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/10">
                  {['Name', 'Contact', 'Lead Status', 'Customer Status', 'Portal', 'Most Recent Interest', 'Created', ''].map((h) => (
                    <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const lead = c.leadCaptures[0]
                  const portalEntry = portalAdoption.byCustomerId.get(c.id)
                  return (
                    <tr key={c.id} className="border-b border-white/10 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/customers/${c.id}`} className="font-semibold text-white hover:text-gold-dark hover:underline">
                          {c.firstName} {c.lastName}
                        </Link>
                        {c.company ? <p className="text-white/45 text-xs">{c.company}</p> : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-white/70">{c.email ?? '—'}</p>
                        <p className="text-white/45 text-xs">{c.phone ? formatPhoneDisplay(c.phone) : '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusBadge status={c.leadStatus as LeadStatusValue} />
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{formatLabel(c.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {portalEntry ? (
                          <span className={`text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${PORTAL_ADOPTION_STATUS_STYLE[portalEntry.status]}`}>
                            {PORTAL_ADOPTION_STATUS_LABEL[portalEntry.status]}
                          </span>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lead ? (
                          <>
                            <p className="text-white">{INTEREST_TYPE_LABEL[lead.interestType] ?? lead.interestType}</p>
                            {lead.productName ? <p className="text-white/45 text-xs">{lead.productName}{lead.productSize ? ` (${lead.productSize})` : ''}</p> : null}
                          </>
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/admin/customers/${c.id}`} className="text-gold font-heading font-bold text-[12px] hover:text-gold-dark">
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {customers.length === 0 && <div className="text-center py-16 text-white/50">No customers match this filter.</div>}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-[12px] text-white/50">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/admin/customers${buildQuery({ ...baseQuery, page: String(page - 1) })}`} className="text-gold hover:text-gold-dark font-bold">
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/admin/customers${buildQuery({ ...baseQuery, page: String(page + 1) })}`} className="text-gold hover:text-gold-dark font-bold">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
