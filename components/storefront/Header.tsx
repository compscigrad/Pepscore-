'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ShoppingCart, Menu, X, Search } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { BrandLockup } from './BrandLockup'
import { PredictiveSearch } from './PredictiveSearch'

// Loaded client-only (ssr: false) so Clerk components never run during
// server-side prerendering, where ClerkProvider context isn't available.
const ClerkAuthButtons = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? dynamic(() => import('./ClerkAuthButtons').then(m => ({ default: m.ClerkAuthButtons })), { ssr: false })
  : null
const MobileClientSignIn = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? dynamic(() => import('./ClerkAuthButtons').then(m => ({ default: m.MobileClientSignIn })), { ssr: false })
  : null

export function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { toggleCart, count } = useCartStore()
  const cartCount = count()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Next.js <Link> only scrolls to top on an actual route change -- clicking
  // href="/" while already on "/" is a no-op for the router (same pathname,
  // no navigation fires), so nothing scrolls. Identical on every breakpoint;
  // it just reads as "desktop-only" because a short mobile viewport rarely
  // scrolls far enough for the missing reset to be visible. Explicit scroll
  // covers the already-home case; navigating in from another route still
  // goes through Link's normal routing, which Next.js already scrolls to
  // the top of by default.
  function handleLogoClick(e: React.MouseEvent) {
    if (pathname === '/') {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <header
      className={`relative sticky top-0 z-[900] bg-black border-b transition-shadow ${
        scrolled ? 'border-[#D4AF37]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4)]' : 'border-[#D4AF37]/15'
      }`}
    >
      {/* nav owns the horizontal page padding (px-6) as its own full-width
          box; the inner div below is the max-w-[1200px] mx-auto content
          box with NO padding of its own -- the same two-level pattern every
          other homepage section uses (outer full-width px-6, inner
          max-w-1200 mx-auto). Previously nav combined max-w+mx-auto+px-6 on
          a single element, which added an extra ~24px inset on top of the
          centering gap and made the logo sit further right than the hero/
          body content below it (2026-08-13 grid-alignment fix). */}
      <nav className="px-6">
        {/* gap-5 below xl is a guaranteed minimum between the logo and the
            right-actions cluster on mobile/tablet, where the desktop nav
            <ul> (which normally fills this space) is hidden -- the gold
            Cart button was the one crowding the wordmark there, not the
            auth CTA. At xl+ the <ul> already provides real spacing, so
            gap-3 is restored to avoid over-shifting anything on larger
            viewports. */}
        <div className="max-w-[1200px] mx-auto h-[72px] flex items-center justify-between gap-5 xl:gap-3">
          {/* Logo — the approved gold "P" mark plus the PEPSCORE / LAB
              wordmark lockup, now a shared component (components/storefront/
              BrandLockup.tsx) so the footer's large closing brand mark
              reuses this exact same implementation instead of a second,
              drifting copy. */}
          <Link href="/" onClick={handleLogoClick} aria-label="Pepscore Lab — Back to top" className="flex-shrink-0">
            <BrandLockup size="navbar" />
          </Link>

          {/* Desktop nav links -- shown from xl (1280px) rather than md
              (768px): at md this row plus search/cart/auth didn't fit
              (measured overflow around 834px, wrapping nav labels and
              clipping the cart button). lg (1024px) still wasn't enough --
              measured wrapping ("Bulk Orders"/"Why Us" breaking to two
              lines) up through ~1050px. xl (1280px) is the first standard
              breakpoint confirmed clean with real margin to spare across
              1100-1440px+ in testing, so the existing mobile hamburger
              pattern now covers the whole tablet/laptop range below it
              instead of a cramped or wrapping desktop row (2026-08-13). */}
          <ul className="hidden xl:flex gap-7 items-center list-none">
            {[
              ['Products', '/#products'],
              ['Categories', '/categories'],
              ['Bulk Orders', '/#bulk'],
              ['Why Us', '/#features'],
              ['Mission', '/#about'],
              ['Contact', '/#contact'],
            ].map(([label, href]) => (
              <li key={label}>
                <Link
                  href={href}
                  className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/75 hover:text-[#D4AF37] transition-colors"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Search — icon toggles an inline predictive field on desktop */}
            <div className="hidden xl:flex items-center">
              {searchOpen ? (
                <PredictiveSearch
                  autoFocus
                  onClose={() => setSearchOpen(false)}
                  inputClassName="w-[220px] border border-white/15 bg-white/[0.04] rounded-full px-4 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              ) : (
                <button onClick={() => setSearchOpen(true)} aria-label="Open search" className="p-1.5 text-white/75 hover:text-[#D4AF37] transition-colors">
                  <Search size={19} />
                </button>
              )}
            </div>

            {/* Cart -- text label hidden below sm to reclaim horizontal
                space on narrow viewports (icon + count badge alone is
                still clearly identifiable and keeps its own aria-label). */}
            <button
              onClick={toggleCart}
              className="flex items-center gap-2 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black px-3 sm:px-4 py-2.5 rounded-full font-heading text-[12px] font-bold tracking-[0.05em] transition-all hover:-translate-y-px"
              aria-label="Open cart"
            >
              <ShoppingCart size={15} />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="bg-black text-[#D4AF37] rounded-full w-5 h-5 text-[11px] font-extrabold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth buttons — client-only to avoid SSR/prerender issues with Clerk */}
            {ClerkAuthButtons && <ClerkAuthButtons />}

            {/* Mobile hamburger */}
            <button
              className="xl:hidden p-1 text-white"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="xl:hidden bg-black border-t border-[#D4AF37]/15 px-6 py-4 flex flex-col gap-4">
          <PredictiveSearch
            className="w-full"
            onClose={() => setMenuOpen(false)}
            inputClassName="w-full border border-white/15 bg-white/[0.04] rounded-full px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
          />
          {[
            ['Products', '/#products'],
            ['Categories', '/categories'],
            ['Bulk Orders', '/#bulk'],
            ['Why Us', '/#features'],
            ['Mission', '/#about'],
            ['Contact', '/#contact'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-white/80 hover:text-[#D4AF37]"
            >
              {label}
            </Link>
          ))}
          {MobileClientSignIn && (
            <div className="pt-2 border-t border-[#D4AF37]/15">
              <MobileClientSignIn />
            </div>
          )}
        </div>
      )}
    </header>
  )
}
