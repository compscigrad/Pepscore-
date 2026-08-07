// Shown in place of the real checkout form while
// lib/storefront/checkoutGate.ts's kill switch is off. Matches the site's
// existing card/shadow/button vocabulary rather than inventing new styling.
import Link from 'next/link'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { STOREFRONT_CHECKOUT_DISABLED_MESSAGE } from '@/lib/storefront/checkoutGate'

export function CheckoutComingSoon() {
  return (
    <>
      <Header />
      <main className="bg-cream min-h-[70vh] flex items-center justify-center px-6 py-20">
        <div className="max-w-[520px] w-full bg-white rounded-2xl shadow-sh p-10 text-center">
          <p className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3">Coming Soon</p>
          <h1 className="font-heading text-2xl font-bold text-dark mb-4">Online Ordering Is Coming Soon</h1>
          <p className="text-[14px] text-g700 leading-relaxed mb-8">{STOREFRONT_CHECKOUT_DISABLED_MESSAGE}</p>
          <Link
            href="/#products"
            className="inline-block bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-md transition-colors"
          >
            Browse Products
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
