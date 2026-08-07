// Shown in place of the real checkout form while
// lib/storefront/checkoutGate.ts's kill switch is off. Matches the dark
// Pepscore Lab storefront vocabulary rather than inventing new styling.
import Link from 'next/link'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { STOREFRONT_CHECKOUT_DISABLED_MESSAGE } from '@/lib/storefront/checkoutGate'

export function CheckoutComingSoon() {
  return (
    <>
      <Header />
      <main className="bg-black min-h-[70vh] flex items-center justify-center px-6 py-20">
        <div className="max-w-[520px] w-full bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-2xl p-10 text-center">
          <p className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3">Coming Soon</p>
          <h1 className="font-heading text-2xl font-bold text-white mb-4">Online Ordering Is Coming Soon</h1>
          <p className="text-[14px] text-white/60 leading-relaxed mb-8">{STOREFRONT_CHECKOUT_DISABLED_MESSAGE}</p>
          <Link
            href="/#products"
            className="inline-block bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-full transition-all hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)]"
          >
            Browse Products
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
