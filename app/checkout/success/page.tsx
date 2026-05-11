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

  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      customerEmail = session.customer_email
      // Look up order by Stripe session ID
      const order = await prisma.order.findUnique({
        where: { stripeSessionId: session_id },
        select: { orderNumber: true },
      })
      orderNumber = order?.orderNumber ?? null
    } catch {
      // Session not found or DB unavailable — still show a success message
    }
  }

  return (
    <>
      <Header />
      <main className="bg-cream min-h-screen flex items-center justify-center px-6 py-20">
        <div className="bg-white rounded-2xl shadow-sl max-w-lg w-full p-10 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">
            ✓
          </div>
          <h1 className="font-heading text-2xl font-bold text-dark mb-2">Order Confirmed!</h1>
          <p className="text-g500 text-[15px] mb-6 leading-relaxed">
            Thank you for your order. A confirmation email with your invoice has been sent
            {customerEmail ? ` to ${customerEmail}` : ''}.
          </p>

          {orderNumber && (
            <div className="bg-g100 rounded-xl p-4 mb-6">
              <p className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-g500 mb-1">Order Number</p>
              <p className="font-heading text-[20px] font-bold text-gold-dark">{orderNumber}</p>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-7 text-left">
            <p className="text-[12px] text-g700 leading-relaxed">
              ⚠️ <strong>Reminder:</strong> All Pepscore products are For Research Use Only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/account"
              className="flex-1 bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-md text-center transition-colors"
            >
              View My Orders
            </Link>
            <Link
              href="/"
              className="flex-1 border border-g300 text-g700 font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-md text-center hover:bg-g100 transition-colors"
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
