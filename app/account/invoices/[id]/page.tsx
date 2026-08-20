// Customer invoice detail — the one route in this sprint most tempting to
// leak internal-only data through, since getPortalInvoiceDetail fetches
// full Shipment/BackorderCondition rows (the query has no reason to
// duplicate a second narrower query). This component is the actual
// enforcement point: only the fields explicitly destructured below ever
// reach JSX. Shipment.labelUrl/qrCodeUrl/providerName/providerTrackingId,
// BackorderCondition.notes, and Invoice.internalNotes are fetched but never
// rendered here.
export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getPortalAuthState } from '@/lib/portalAuth'
import { getPortalInvoiceDetail } from '@/lib/portal/invoices'
import { formatMoney, formatDate, formatCarrierLabel } from '@/lib/invoice/format'
import { isTrackableCarrier } from '@/lib/tracking/types'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { PortalPaymentControls } from '@/components/account/PortalPaymentControls'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const authState = await getPortalAuthState()
  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')
  if (authState.state === 'NOT_LINKED') return <PortalStatusShell heading="No account found" body="Contact us to get set up." />
  if (authState.state === 'CLOSED') return <PortalStatusShell heading="Account closed" body="This account was closed. If this was accidental or you need assistance, contact us." />
  if (authState.state === 'DISABLED') return <PortalStatusShell heading="Access disabled" body="Contact us if you believe this is a mistake." />

  const { id } = await params
  const invoice = await getPortalInvoiceDetail(authState.customer.id, id)
  if (!invoice) notFound()

  const activeBackorders = invoice.backorderConditions.filter((b) => b.status === 'ACTIVE')

  return (
    <main className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/account/invoices" className="text-white/40 hover:text-white text-xs">
            ← All Invoices
          </Link>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
            <p className="text-white/40 text-xs mt-1">{formatDate(invoice.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} variant="invoice" />
            <StatusBadge status={invoice.paymentStatus} variant="payment" />
          </div>
        </div>

        {invoice.order ? (
          <Link
            href={`/account/orders/${invoice.order.id}`}
            className="block text-xs text-gold-light hover:text-gold font-heading font-bold uppercase tracking-[0.08em]"
          >
            View Order {invoice.order.orderNumber} →
          </Link>
        ) : null}

        {/* Line items + totals */}
        <div className="bg-white/[0.03] border border-white/10 rounded-[18px] p-6">
          <div className="divide-y divide-white/10">
            {invoice.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between text-sm">
                <div>
                  <p className="text-white">
                    {item.name} <span className="text-white/40">× {item.quantity}</span>
                  </p>
                  {item.description ? <p className="text-white/40 text-xs mt-0.5">{item.description}</p> : null}
                </div>
                <p className="text-white/80">{formatMoney(item.total)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-1 text-sm">
            <div className="flex justify-between text-white/60"><span>Subtotal</span><span>{formatMoney(invoice.subtotal)}</span></div>
            {invoice.shippingCost > 0 ? (
              <div className="flex justify-between text-white/60"><span>Shipping</span><span>{formatMoney(invoice.shippingCost)}</span></div>
            ) : null}
            {invoice.discounts.map((d) => (
              <div key={d.id} className="flex justify-between text-white/60"><span>{d.label}</span><span>-{formatMoney(d.appliedAmount)}</span></div>
            ))}
            <div className="flex justify-between text-white font-bold text-base pt-2 border-t border-white/10 mt-2">
              <span>Total</span><span>{formatMoney(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-white/60"><span>Amount Paid</span><span>{formatMoney(invoice.amountPaid)}</span></div>
            {invoice.amountRefunded > 0 ? (
              <div className="flex justify-between text-white/60"><span>Refunded</span><span>{formatMoney(invoice.amountRefunded)}</span></div>
            ) : null}
            <div className="flex justify-between text-white font-bold">
              <span>Balance Due</span>
              <span className={invoice.balanceDue > 0 ? 'text-gold' : ''}>{formatMoney(invoice.balanceDue)}</span>
            </div>
          </div>
          <a
            href={`/api/account/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block text-gold-light hover:text-gold text-xs font-heading font-bold uppercase tracking-[0.08em]"
          >
            Download Receipt (PDF) →
          </a>
        </div>

        <PortalPaymentControls
          invoiceId={invoice.id}
          balanceDue={invoice.balanceDue}
          paymentIntentStatus={invoice.paymentIntentStatus}
          selectedPaymentMethod={invoice.selectedPaymentMethod}
          arrangement={
            invoice.paymentArrangement
              ? {
                  status: invoice.paymentArrangement.status,
                  frequency: invoice.paymentArrangement.frequency,
                  denialReason: invoice.paymentArrangement.denialReason,
                  installments: invoice.paymentArrangement.installments.map((i) => ({
                    id: i.id,
                    installmentNumber: i.installmentNumber,
                    dueDate: i.dueDate.toISOString(),
                    amount: i.amount,
                    status: i.status,
                  })),
                }
              : null
          }
        />

        {invoice.payments.length > 0 ? (
          <Section title="Payment History">
            <div className="space-y-2">
              {invoice.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-sm bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <span className="text-white/70">{formatDate(p.paidAt)} — {p.method}</span>
                  <span className="text-white font-medium">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {invoice.shipments.length > 0 ? (
          <Section title="Shipping & Tracking">
            <div className="space-y-2">
              {invoice.shipments.map((s) => (
                <div key={s.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-white text-sm font-medium">
                      {s.carrier} — {s.trackingNumber}
                    </p>
                    <StatusBadge status={s.normalizedStatus} variant="shipping" />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {s.trackingUrl ? (
                      <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold-light hover:text-gold text-xs">
                        Track Package →
                      </a>
                    ) : null}
                    {s.estimatedDeliveryAt ? (
                      <span className="text-white/40 text-xs">Est. delivery {formatDate(s.estimatedDeliveryAt)}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : invoice.carrier && !isTrackableCarrier(invoice.carrier) ? (
          // Self-delivery/pickup order -- no real Shipment row is ever
          // expected here, so this is a resolved state, not an empty one.
          <Section title="Delivery">
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-white text-sm font-medium">{formatCarrierLabel(invoice.carrier)}</p>
                <span className="text-blue-300 text-xs font-heading font-bold uppercase tracking-[0.06em]">
                  {invoice.deliveryStatus === 'DELIVERED' ? 'Delivered' : 'Preparing for delivery'}
                </span>
              </div>
              <p className="text-white/40 text-xs mt-1.5">This order is not shipped via a trackable carrier — no tracking number applies.</p>
            </div>
          </Section>
        ) : null}

        {activeBackorders.length > 0 ? (
          <Section title="Backordered Items">
            <div className="space-y-2">
              {activeBackorders.map((b) => (
                <div key={b.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{b.productName}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {b.expectedAvailableDate ? `Expected ${formatDate(b.expectedAvailableDate)}` : 'Expected date to be confirmed'}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {invoice.refunds.length > 0 ? (
          <Section title="Refunds">
            <div className="space-y-2">
              {invoice.refunds.map((r) => (
                <div key={r.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {formatMoney(r.requestedAmount)} requested
                      {r.completedAmount != null ? `, ${formatMoney(r.completedAmount)} completed` : ''}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {r.status === 'COMPLETED'
                        ? `Completed ${formatDate(r.completedAt)}`
                        : 'Pending — nothing has been returned yet until this is marked completed'}
                    </p>
                  </div>
                  <StatusBadge status={r.status} variant="refund" />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {invoice.issuedAccountCredits.length > 0 ? (
          <Section title="Account Credit Issued">
            <div className="space-y-2">
              {invoice.issuedAccountCredits.map((c) => (
                <div key={c.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{formatMoney(c.amount)} — {c.reason}</p>
                  {c.remainingAmount !== c.amount ? (
                    <p className="text-white/40 text-xs mt-0.5">{formatMoney(c.remainingAmount)} remaining</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {invoice.balanceTransfersOut.length > 0 || invoice.balanceTransfersIn.length > 0 ? (
          <Section title="Balance Transfers">
            <div className="space-y-2">
              {invoice.balanceTransfersOut.map((t) => (
                <div key={t.id} className="text-sm bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white/70">
                  {formatMoney(t.amount)} moved to Invoice {t.destinationInvoice.invoiceNumber} — {formatDate(t.transferredAt)}
                </div>
              ))}
              {invoice.balanceTransfersIn.map((t) => (
                <div key={t.id} className="text-sm bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white/70">
                  {formatMoney(t.amount)} moved in from Invoice {t.sourceInvoice.invoiceNumber} — {formatDate(t.transferredAt)}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-3">{title}</h2>
      {children}
    </div>
  )
}
