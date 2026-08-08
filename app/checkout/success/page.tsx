// Post-payment success page — verifies session and shows order confirmation
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'

interface Props {
  searchParams: Promise<{ session_id?: string }>
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams

  let orderNumber: string | null = null
  let customerEmail: string | null = null
  // ACH doesn't settle synchronously -- an order reaching this page may
  // still be PROCESSING (Payment.status), not actually PAID. Never claim
  // "confirmed" for a debit that hasn't cleared yet (see docs/Decisions.md's
  // ACH entry) -- this page's copy branches on the real Order status
  // instead of assuming every arrival here means payment succeeded.
  let paymentStillProcessing = false

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      customerEmail = session.customer_email
      // Look up order by Stripe session ID
      const order = await prisma.order.findUnique({
        where: { stripeSessionId: session_id },
        select: { orderNumber: true, status: true },
      })
      orderNumber = order?.orderNumber ?? null
      paymentStillProcessing = order?.status === 'PENDING'
    } catch {
      // Session not found or DB unavailable — still show a success message
    }
  }

  return (
    <>
      <Header />
      <main className="bg-black min-h-screen flex items-center justify-center px-6 py-20">
        <div className="bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-lg w-full p-10 text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl ${
              paymentStillProcessing ? 'bg-amber-400/10 border border-amber-400/25 text-amber-300' : 'bg-green-400/10 border border-green-400/25 text-green-400'
            }`}
          >
            {paymentStillProcessing ? '⏳' : '✓'}
          </div>
          <h1 className="font-heading text-2xl font-bold text-white mb-2">
            {paymentStillProcessing ? 'Payment Processing' : 'Order Confirmed!'}
          </h1>
          <p className="text-white/55 text-[15px] mb-6 leading-relaxed">
            {paymentStillProcessing
              ? "Thanks — we've submitted your bank payment and are waiting for your bank to confirm it. This can take a few business days; we'll email you the moment it clears."
              : 'Thank you for your order. A confirmation email with your invoice has been sent'}
            {!paymentStillProcessing && customerEmail ? ` to ${customerEmail}` : ''}
            {!paymentStillProcessing ? '.' : ''}
          </p>

          {orderNumber && (
            <div className="bg-white/[0.04] border border-[#D4AF37]/15 rounded-xl p-4 mb-6">
              <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/45 mb-1">Order Number</p>
              <p className="font-heading text-[20px] font-bold text-[#D4AF37]">{orderNumber}</p>
            </div>
          )}

          <div className="bg-amber-400/10 border border-amber-400/25 rounded-xl p-4 mb-7 text-left">
            <p className="text-[12px] text-white/70 leading-relaxed">
              ⚠️ <strong className="text-white">Reminder:</strong> All Pepscore Lab products are For Research Use Only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/account"
              className="flex-1 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full text-center transition-all hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)]"
            >
              View My Orders
            </Link>
            <Link
              href="/"
              className="flex-1 border border-white/20 text-white/70 font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full text-center hover:bg-white/5 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
