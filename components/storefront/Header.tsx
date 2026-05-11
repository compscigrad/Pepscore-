'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Menu, X } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Dynamically import Clerk components only when the key is present
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SignedIn: any, SignedOut: any, UserButton: any, SignInButton: any
if (hasClerk) {
  const clerk = require('@clerk/nextjs')
  SignedIn = clerk.SignedIn
  SignedOut = clerk.SignedOut
  UserButton = clerk.UserButton
  SignInButton = clerk.SignInButton
}

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { toggleCart, count } = useCartStore()
  const cartCount = count()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`sticky top-0 z-[900] bg-white border-b border-gold/20 transition-shadow ${
        scrolled ? 'shadow-sm2' : 'shadow-sh'
      }`}
    >
      <nav className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <div className="overflow-hidden w-[112px] h-[44px] relative">
            <Image
              src="/images/logo.png"
              alt="Pepscore"
              fill
              className="object-cover object-left-top scale-[1.43]"
              style={{ marginTop: '-58px', marginLeft: '-24px' }}
              priority
            />
          </div>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden md:flex gap-7 items-center list-none">
          {[
            ['Products', '/#products'],
            ['Pricing', '/#pricing'],
            ['Bulk Orders', '/#bulk'],
            ['Why Us', '/#features'],
            ['About', '/#about'],
          ].map(([label, href]) => (
            <li key={label}>
              <Link
                href={href}
                className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-dark hover:text-gold transition-colors"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Cart */}
          <button
            onClick={toggleCart}
            className="flex items-center gap-2 bg-gold hover:bg-gold-dark text-white px-4 py-2.5 rounded-md font-heading text-[12px] font-bold tracking-[0.05em] transition-all hover:-translate-y-px"
            aria-label="Open cart"
          >
            <ShoppingCart size={15} />
            Cart
            {cartCount > 0 && (
              <span className="bg-white text-gold-dark rounded-full w-5 h-5 text-[11px] font-extrabold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Auth — only rendered when Clerk is configured */}
          {hasClerk && (
            <>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-dark hover:text-gold transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-g100 px-6 py-4 flex flex-col gap-4 shadow-sm2">
          {[
            ['Products', '/#products'],
            ['Pricing', '/#pricing'],
            ['Bulk Orders', '/#bulk'],
            ['Why Us', '/#features'],
            ['About', '/#about'],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-dark hover:text-gold"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
