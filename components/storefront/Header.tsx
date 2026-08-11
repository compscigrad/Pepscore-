'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ShoppingCart, Menu, X, Search } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

// Loaded client-only (ssr: false) so Clerk components never run during
// server-side prerendering, where ClerkProvider context isn't available.
const ClerkAuthButtons = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? dynamic(() => import('./ClerkAuthButtons').then(m => ({ default: m.ClerkAuthButtons })), { ssr: false })
  : null

export function Header() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { toggleCart, count } = useCartStore()
  const cartCount = count()

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = searchValue.trim()
    if (!q) return
    // Query length only, never the raw query text -- a search term could
    // incidentally contain something the visitor typed that identifies
    // them (an email, a name), so this event tracks that a search
    // happened without recording what was searched for.
    trackEvent(AnalyticsEvent.SEARCH, { queryLength: q.length })
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
    setMenuOpen(false)
  }

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`sticky top-0 z-[900] bg-black border-b transition-shadow ${
        scrolled ? 'border-[#D4AF37]/25 shadow-[0_4px_16px_rgba(0,0,0,0.4)]' : 'border-[#D4AF37]/15'
      }`}
    >
      <nav className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between">
        {/* Logo — text wordmark (the source raster logo.png has an opaque
            cream background baked in and reads "Pepscore" not "Pepscore
            Lab"; matches the landing site's own text-only brand mark) */}
        <Link href="/" className="flex-shrink-0 font-heading text-[19px] font-extrabold tracking-[-0.01em] leading-none">
          <span className="text-white">Pepscore</span>{' '}
          <span className="bg-gradient-to-br from-[#D4AF37] via-[#E8C84A] to-[#D4AF37] bg-clip-text text-transparent">Lab</span>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden md:flex gap-7 items-center list-none">
          {[
            ['Products', '/#products'],
            ['Categories', '/categories'],
            ['Pricing', '/#pricing'],
            ['Bulk Orders', '/#bulk'],
            ['Why Us', '/#features'],
            ['About', '/#about'],
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
          {/* Search — icon toggles an inline field on desktop */}
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <form onSubmit={submitSearch} className="flex items-center">
                <input
                  type="search"
                  autoFocus
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onBlur={() => !searchValue && setSearchOpen(false)}
                  placeholder="Search products…"
                  aria-label="Search products"
                  className="w-[180px] border border-white/15 bg-white/[0.04] rounded-full px-4 py-2 text-[13px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
                />
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} aria-label="Open search" className="p-1.5 text-white/75 hover:text-[#D4AF37] transition-colors">
                <Search size={19} />
              </button>
            )}
          </div>

          {/* Cart */}
          <button
            onClick={toggleCart}
            className="flex items-center gap-2 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black px-4 py-2.5 rounded-full font-heading text-[12px] font-bold tracking-[0.05em] transition-all hover:-translate-y-px"
            aria-label="Open cart"
          >
            <ShoppingCart size={15} />
            Cart
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
            className="md:hidden p-1 text-white"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-black border-t border-[#D4AF37]/15 px-6 py-4 flex flex-col gap-4">
          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <input
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="flex-1 border border-white/15 bg-white/[0.04] rounded-full px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
            />
            <button type="submit" aria-label="Search" className="p-2.5 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black rounded-full">
              <Search size={18} />
            </button>
          </form>
          {[
            ['Products', '/#products'],
            ['Categories', '/categories'],
            ['Pricing', '/#pricing'],
            ['Bulk Orders', '/#bulk'],
            ['Why Us', '/#features'],
            ['About', '/#about'],
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
        </div>
      )}
    </header>
  )
}
