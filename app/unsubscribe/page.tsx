// One-click marketing-email unsubscribe (2026-08-19 lead-capture/
// conversion engine, section 25 -- consent/suppression center). Sets
// Customer.marketingEmailOptedOut = true, the email-channel equivalent of
// the existing SMS smsOptedOut field (driven by inbound Twilio STOP/START).
// The link carries only the customer's own opaque cuid -- no separate
// signed token -- because the only effect this page can ever have is
// turning marketing consent OFF for that one customer: idempotent,
// strictly one-directional, and never exposes or changes anything else, so
// the worst case of a guessed/shared id is a harmless no-op unsubscribe,
// not a privacy or security issue. Every marketing send (see
// lib/notifications/routing.ts's isMarketingCategory()) includes this link.
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { prisma } from '@/lib/prisma'
import { recordCustomerActivity } from '@/lib/customers'

export const metadata: Metadata = {
  title: 'Unsubscribe | Pepscore Lab',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ c?: string }>
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { c: customerId } = await searchParams

  let outcome: 'MISSING' | 'NOT_FOUND' | 'ALREADY' | 'UNSUBSCRIBED' = 'MISSING'

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, marketingEmailOptedOut: true } })
    if (!customer) {
      outcome = 'NOT_FOUND'
    } else if (customer.marketingEmailOptedOut) {
      outcome = 'ALREADY'
    } else {
      await prisma.customer.update({ where: { id: customerId }, data: { marketingEmailOptedOut: true } })
      await recordCustomerActivity({ customerId, eventType: 'MARKETING_EMAIL_UNSUBSCRIBED', source: 'SYSTEM' })
      outcome = 'UNSUBSCRIBED'
    }
  }

  const copy: Record<typeof outcome, { heading: string; body: string }> = {
    MISSING: { heading: 'Nothing to unsubscribe', body: 'This link is missing the information needed to process an unsubscribe request. If you received a marketing email from us and want to stop, please contact us directly.' },
    NOT_FOUND: { heading: 'Link no longer valid', body: 'We could not find an account matching this unsubscribe link.' },
    ALREADY: { heading: "You're already unsubscribed", body: "You won't receive marketing emails from Pepscore Lab. Order and account emails are unaffected." },
    UNSUBSCRIBED: { heading: "You've been unsubscribed", body: "You won't receive marketing emails from Pepscore Lab going forward. Order and account emails (receipts, shipping updates) are unaffected." },
  }
  const { heading, body } = copy[outcome]

  return (
    <>
      <CartSidebar />
      <Header />
      <main className="min-h-[60vh] px-4 py-20">
        <div className="max-w-md mx-auto text-center">
          <h1 className="font-heading text-2xl font-bold text-white mb-3">{heading}</h1>
          <p className="text-white/60 text-[14px] leading-relaxed">{body}</p>
        </div>
      </main>
      <Footer />
    </>
  )
}
