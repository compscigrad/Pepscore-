// Customer profile — the internal record behind a name in the invoice
// tables (InvoiceTable.tsx, invoice detail header). Read-only aggregation
// view: every field here is either edited from an invoice's own Customer
// Info section (which upserts back onto this same Customer row) or written
// by the system (status, activity log, communications) — there's no
// separate "edit customer" form to keep in sync with those paths.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getCustomerProfileData, getCustomerInvoiceHistory, findPossibleDuplicateCustomers } from '@/lib/customers'
import { currentPeriod, getInvoiceHistoryYearRange } from '@/lib/invoice/historyPeriod'
import { formatCurrency } from '@/lib/orders'
import { formatDate, formatCarrierLabel, formatPaymentMethodLabel, formatPhoneDisplay } from '@/lib/invoice/format'
import { CorrespondenceHistory } from '@/components/invoices/CorrespondenceHistory'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { InvoiceHistoryFilter } from '@/components/invoices/InvoiceHistoryFilter'
import { InvoiceArchiveButton } from '@/components/invoices/InvoiceArchiveButton'
import { card, mutedText, sectionHeading, pillPrimary } from '@/components/invoices/theme'
import { PortalAccessSection } from '@/components/admin/PortalAccessSection'
import { CustomerPortalStatusSection } from '@/components/admin/CustomerPortalStatusSection'
import { SpaEligibilitySection } from '@/components/admin/SpaEligibilitySection'
import { computePortalAdoptionOverview } from '@/lib/portal/adoptionStatus'
import { AccessHistorySection } from '@/components/admin/AccessHistorySection'
import { LocalTimestamp } from '@/components/admin/LocalTimestamp'
import { CustomerContactEditor } from '@/components/admin/CustomerContactEditor'
import { CustomerNotesEditor } from '@/components/admin/CustomerNotesEditor'
import { CustomerLeadStatusControl, LeadStatusBadge, type LeadStatusValue } from '@/components/admin/CustomerLeadStatusControl'
import { CustomerLeadCaptureHistory } from '@/components/admin/CustomerLeadCaptureHistory'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string; year?: string; period?: string }>
}

// Which the customer actually clicked through to activate their account --
// covers both the admin-invite claim path (PORTAL_ACCOUNT_CLAIMED) and both
// self-service paths (PORTAL_ACCOUNT_SELF_CLAIMED / SELF_REGISTERED), since
// only the admin-invite path ever produces a CustomerPortalInvite.claimedAt.
const ACTIVATION_EVENT_TYPES = new Set(['PORTAL_ACCOUNT_CLAIMED', 'PORTAL_ACCOUNT_SELF_CLAIMED', 'PORTAL_ACCOUNT_SELF_REGISTERED'])

function formatAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null
  const a = address as Record<string, string | undefined>
  const cityLine = [a.city, a.state, a.zip].filter(Boolean).join(', ')
  const lines = [a.street1, a.street2, cityLine, a.country && a.country !== 'US' ? a.country : null].filter(Boolean)
  return lines.length > 0 ? lines.join(', ') : null
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function zipFromAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null
  const zip = (address as Record<string, unknown>).zip
  return typeof zip === 'string' ? zip : null
}

export default async function CustomerProfilePage({ params, searchParams }: PageProps) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const { id } = await params
  const customer = await getCustomerProfileData(id)
  if (!customer) notFound()

  const sp = await searchParams
  const isAllInvoices = sp.period === 'all'
  const selectedPeriod = isAllInvoices
    ? currentPeriod()
    : { month: Number(sp.month) || currentPeriod().month, year: Number(sp.year) || currentPeriod().year }
  const [invoiceHistory, invoiceYearRange] = await Promise.all([
    getCustomerInvoiceHistory(customer.id, isAllInvoices ? undefined : selectedPeriod),
    getInvoiceHistoryYearRange(customer.id),
  ])

  const portalAdoption = await computePortalAdoptionOverview()
  const portalEntry = portalAdoption.byCustomerId.get(customer.id) ?? { status: 'NOT_ELIGIBLE' as const, reason: null }
  const latestPortalInvite = customer.portalInvites[0] ?? null
  const activationLogEntry = [...customer.activityLog].reverse().find((e) => ACTIVATION_EVENT_TYPES.has(e.eventType))

  const duplicates = await findPossibleDuplicateCustomers({
    firstName: customer.firstName,
    lastName: customer.lastName,
    company: customer.company,
    shippingAddressZip: zipFromAddress(customer.shippingAddress),
    excludeCustomerId: customer.id,
  })

  const fullName = `${customer.firstName} ${customer.lastName}`.trim()
  const billingAddress = formatAddress(customer.billingAddress)
  const shippingAddress = formatAddress(customer.shippingAddress)
  const totalOutstanding = customer.invoices.reduce((sum, inv) => sum + inv.balanceDue, 0)
  const availableCredit = customer.accountCredits.reduce((sum, c) => sum + c.remainingAmount, 0)

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-heading text-3xl font-bold text-white">{fullName}</h1>
              <StatusBadge status={customer.status} variant="customer" />
              <LeadStatusBadge status={customer.leadStatus as LeadStatusValue} />
            </div>
            {customer.company ? <p className="text-white/50 text-sm mt-1">{customer.company}</p> : null}
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-[11px] font-heading font-bold uppercase tracking-wide text-white/40`}>Lead status</span>
              <CustomerLeadStatusControl customerId={customer.id} leadStatus={customer.leadStatus as LeadStatusValue} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Link href={`/admin/invoices/new?customerId=${customer.id}`} className={`${pillPrimary} px-6 py-2.5`}>
              + New Invoice
            </Link>
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          </div>
        </div>

        {duplicates.length > 0 ? (
          <div className={`${card} p-4 border-amber-400/30 bg-amber-400/[0.04]`}>
            <p className="text-[11px] font-heading font-bold uppercase tracking-[0.08em] text-amber-300 mb-2">
              Possible Duplicate {duplicates.length === 1 ? 'Record' : 'Records'}
            </p>
            <div className="space-y-1">
              {duplicates.map(({ customer: dup, reasons }) => (
                <p key={dup.id} className="text-sm text-white/70">
                  <Link href={`/admin/customers/${dup.id}`} className="text-gold-light hover:underline font-medium">
                    {dup.firstName} {dup.lastName}
                  </Link>
                  {dup.company ? ` — ${dup.company}` : ''} — matched on {reasons.map(formatLabel).join(', ')}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${card} p-6 space-y-3`}>
            <h3 className={sectionHeading}>Contact</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Email</dt>
                <dd className="text-white">{customer.email ?? '—'}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Phone</dt>
                <dd className="text-white flex items-center gap-2">
                  {customer.phone ? formatPhoneDisplay(customer.phone) : '—'}
                  {customer.smsOptedOut && (
                    <span className="text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-red-400/10 text-red-300 border border-red-400/20">
                      SMS Opted Out
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Preferred Contact</dt>
                <dd className="text-white">{customer.preferredContactMethod ? formatLabel(customer.preferredContactMethod) : '—'}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Preferred Payment</dt>
                <dd className="text-white">
                  {customer.preferredPaymentMethod ? formatPaymentMethodLabel(customer.preferredPaymentMethod) : '—'}
                </dd>
              </div>
            </dl>
            <CustomerContactEditor
              customerId={customer.id}
              firstName={customer.firstName}
              lastName={customer.lastName}
              email={customer.email}
              phone={customer.phone}
              company={customer.company}
              billingAddress={customer.billingAddress}
              shippingAddress={customer.shippingAddress}
            />
          </div>

          <div className={`${card} p-6 space-y-3`}>
            <h3 className={sectionHeading}>Addresses</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className={`${mutedText} text-[11px] uppercase tracking-wide`}>Billing</p>
                <p className="text-white whitespace-pre-wrap">{billingAddress ?? '—'}</p>
              </div>
              <div>
                <p className={`${mutedText} text-[11px] uppercase tracking-wide`}>Shipping</p>
                <p className="text-white whitespace-pre-wrap">{shippingAddress ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className={`${card} p-6 space-y-3`}>
            <h3 className={sectionHeading}>Financial Summary</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Outstanding Balance</dt>
                <dd className="text-white font-medium">{formatCurrency(totalOutstanding)}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Available Account Credit</dt>
                <dd className="text-white font-medium">{formatCurrency(availableCredit)}</dd>
              </div>
              <div>
                <dt className={`${mutedText} text-[11px] uppercase tracking-wide`}>Invoices</dt>
                <dd className="text-white font-medium">{customer.invoices.length}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className={`${card} p-6 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className={sectionHeading}>Notes</h3>
          </div>
          {customer.notes ? <p className="text-sm text-white/70 whitespace-pre-wrap">{customer.notes}</p> : <p className={`text-sm ${mutedText}`}>No notes yet.</p>}
          <CustomerNotesEditor customerId={customer.id} notes={customer.notes} />
        </div>

        <CustomerLeadCaptureHistory leads={customer.leadCaptures} />

        <div className={`${card} p-6 space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className={sectionHeading}>Invoices</h3>
            <InvoiceHistoryFilter
              basePath={`/admin/customers/${customer.id}`}
              month={selectedPeriod.month}
              year={selectedPeriod.year}
              isAll={isAllInvoices}
              minYear={invoiceYearRange?.minYear ?? currentPeriod().year}
              maxYear={invoiceYearRange?.maxYear ?? currentPeriod().year}
            />
          </div>
          {invoiceHistory.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>
              {isAllInvoices ? 'No invoices yet.' : 'No invoices in this month. Try "All" to see full history.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Invoice #</th>
                    <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Date</th>
                    <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Balance</th>
                    <th className="text-left py-2 pr-4 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Status</th>
                    <th className="text-left py-2 font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50">Tracking</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invoiceHistory.map((inv) => (
                    <tr key={inv.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 font-medium text-white whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="py-3 pr-4 text-white/50 whitespace-nowrap">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 pr-4 text-white whitespace-nowrap">{formatCurrency(inv.balanceDue)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge status={inv.status} />
                          {inv.status !== 'DRAFT' ? <StatusBadge status={inv.paymentStatus} variant="payment" /> : null}
                          {inv.archivedAt ? <StatusBadge status="ARCHIVED" /> : null}
                        </div>
                      </td>
                      <td className="py-3 text-white/50 whitespace-nowrap">
                        {inv.carrier ? `${formatCarrierLabel(inv.carrier)} — ${inv.trackingNumber ?? 'pending'}` : '—'}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-3">
                          <InvoiceArchiveButton invoiceId={inv.id} archived={Boolean(inv.archivedAt)} />
                          <Link href={`/admin/invoices/${inv.id}`} className="text-gold-light font-bold text-sm hover:underline">
                            View →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {customer.accountCredits.length > 0 ? (
          <div className={`${card} p-6 space-y-3`}>
            <h3 className={sectionHeading}>Account Credits</h3>
            <div className="space-y-2">
              {customer.accountCredits.map((credit) => (
                <div key={credit.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-white">{credit.reason}</p>
                    <p className={mutedText}>{formatDate(credit.issuedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{formatCurrency(credit.remainingAmount)}</p>
                    <p className={`${mutedText} text-xs`}>of {formatCurrency(credit.amount)} issued</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <CustomerPortalStatusSection
          status={portalEntry.status}
          reason={portalEntry.reason}
          invite={
            latestPortalInvite
              ? {
                  createdAt: latestPortalInvite.createdAt,
                  expiresAt: latestPortalInvite.expiresAt,
                  channel: latestPortalInvite.channel,
                  remindersSent: latestPortalInvite.remindersSent,
                  lastReminderAt: latestPortalInvite.lastReminderAt,
                  revokedAt: latestPortalInvite.revokedAt,
                }
              : null
          }
          activatedAt={activationLogEntry?.createdAt ?? null}
        />

        <PortalAccessSection customerId={customer.id} hasEmail={Boolean(customer.email)} />

        <SpaEligibilitySection customerId={customer.id} />

        {customer.userId ? <AccessHistorySection customerId={customer.id} /> : null}

        <CorrespondenceHistory customerId={customer.id} />

        <div className={`${card} p-6 space-y-3`}>
          <h3 className={sectionHeading}>Activity Timeline</h3>
          {customer.activityLog.length === 0 ? (
            <p className={`text-sm ${mutedText}`}>No recorded activity yet.</p>
          ) : (
            <div className="space-y-2">
              {customer.activityLog.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="text-white">{formatLabel(entry.eventType)}</p>
                    {entry.newValue ? <p className={`${mutedText} text-xs`}>{entry.newValue}</p> : null}
                  </div>
                  <p className={`${mutedText} text-xs whitespace-nowrap`}><LocalTimestamp value={entry.createdAt} /></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
