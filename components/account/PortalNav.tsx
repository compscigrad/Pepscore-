'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const NAV_ITEMS = [
  { href: '/account', label: 'Dashboard' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/invoices', label: 'Invoices' },
  { href: '/account/tracking', label: 'Tracking' },
  { href: '/account/correspondence', label: 'Correspondence' },
  { href: '/account/payment-methods', label: 'Payment Methods' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/support', label: 'Support' },
]

export function PortalNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 bg-dark/95 backdrop-blur border-b border-white/10">
      <div className="max-w-[960px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/account" className="font-heading text-lg font-bold text-white tracking-[0.05em]">
            PEPSCORE <span className="text-gold-light">LAB</span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/account' ? pathname === '/account' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 font-heading text-[11px] font-bold tracking-[0.08em] uppercase px-3 py-2 rounded-full transition-colors ${
                  active ? 'bg-gold text-dark' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
