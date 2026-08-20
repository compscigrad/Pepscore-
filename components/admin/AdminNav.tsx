'use client'

// Shared admin navigation (2026-08-12 admin IA consolidation) -- the audit
// for this sprint found NO shared nav existed: every /admin/** page hand-
// coded its own header link row, none of them matched each other, and
// several real pages (Promotions, every Settings sub-page) were orphaned --
// reachable only by drilling through another page's own links, not from
// the dashboard. This is the one place that changes. It's additive: each
// page's own contextual links (e.g. Invoices -> Trash) still work exactly
// as before; this just guarantees every section is reachable from
// anywhere in two clicks.
import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/admin/NotificationBell'
import { AnchoredDropdown } from '@/components/admin/AnchoredDropdown'
import { BrandLockup } from '@/components/storefront/BrandLockup'

interface NavItem {
  label: string
  href: string
}
interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/admin' }] },
  {
    label: 'Sales',
    items: [
      { label: 'Direct & Manual Sales', href: '/admin/invoices' },
      { label: 'Online Storefront Orders', href: '/admin/orders' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers & Leads', href: '/admin/customers' },
      { label: 'Professional Access', href: '/admin/professional-access' },
      { label: 'Price Match Requests', href: '/admin/price-match' },
      { label: 'Bulk Portal Invite', href: '/admin/customers/portal-invite' },
      { label: 'Portal Adoption', href: '/admin/portal-rollout' },
      { label: 'Identity Review', href: '/admin/identity-review' },
      { label: 'Intake Queue', href: '/admin/intake-queue' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Product Master', href: '/admin/catalog/product-master' },
      { label: 'Inventory & Pricing', href: '/admin/inventory' },
      { label: 'Promotions', href: '/admin/promotions' },
    ],
  },
  {
    label: 'Fulfillment',
    items: [{ label: 'Command Center', href: '/admin/fulfillment' }],
  },
  {
    label: 'Finance',
    items: [{ label: 'Finance', href: '/admin/finance' }],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Search Demand', href: '/admin/intelligence/search' },
      { label: 'Product Engagement', href: '/admin/intelligence/products' },
      { label: 'AI Control Panel', href: '/admin/intelligence/ai-status' },
    ],
  },
  {
    label: 'Policies',
    items: [{ label: 'Policies & Operations', href: '/admin/policies' }],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Invoice Settings', href: '/admin/settings/invoices' },
      { label: 'Discounts', href: '/admin/settings/discounts' },
      { label: 'Fulfillment', href: '/admin/settings/fulfillment' },
      { label: 'Payments', href: '/admin/settings/payments' },
      { label: 'Notifications', href: '/admin/settings/notifications' },
      { label: 'Email Templates', href: '/admin/settings/email-templates' },
      { label: 'First-Order Offer', href: '/admin/settings/first-order-offer' },
      { label: 'Acquisition Popup', href: '/admin/settings/acquisition-popup' },
    ],
  },
]

function GroupMenu({ group, active }: { group: NavGroup; active: boolean }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Portaling the dropdown (see AnchoredDropdown) means the trigger and the
  // panel are no longer the same contiguous DOM subtree, so a plain
  // mouseleave-closes-instantly handler fires the instant the cursor
  // crosses the small visual gap between the button and the panel below it
  // -- the classic "hover intent" gap problem. A short cancelable delay on
  // close (cleared by either the trigger or the panel re-entering) fixes it
  // without losing hover-to-open.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }
  const openNow = () => {
    cancelClose()
    setOpen(true)
  }
  const closeNow = () => {
    cancelClose()
    setOpen(false)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div onMouseEnter={openNow} onMouseLeave={scheduleClose}>
      <button
        ref={buttonRef}
        onClick={() => (open ? closeNow() : openNow())}
        className={`font-heading text-[12px] font-bold tracking-[0.06em] uppercase px-3 py-2 rounded-lg transition-colors ${
          active ? 'text-gold bg-white/[0.06]' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        {group.label}
      </button>
      <AnchoredDropdown open={open} anchorRef={buttonRef} align="left" onMouseEnter={openNow} onMouseLeave={scheduleClose}>
        <div className="mt-1 min-w-[220px] bg-[#141414] border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1.5 overflow-hidden">
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeNow}
              className="block px-4 py-2.5 text-[13px] text-white/75 hover:text-gold hover:bg-white/[0.04] whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </AnchoredDropdown>
    </div>
  )
}

export function AdminNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav className="sticky top-0 z-[80] bg-black border-b border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-[52px] flex items-center gap-1 overflow-x-auto">
        {/* Brand lockup cleanup (2026-08-19): reuses the exact storefront
            PEPSCORE/LAB lockup (components/storefront/BrandLockup.tsx,
            size="navbar") instead of a plain-text imitation that never
            matched the approved brand treatment. ADMIN sits beside it as a
            single larger word rather than the previous tiny muted suffix --
            sized per-breakpoint to approximate the two-line PEPSCORE/LAB
            stack's own total height (13+4+8=25px base / 15+4+9=28px sm /
            17+4+10=31px md, measured from BrandLockup's own navbar size
            config), so it reads as a real second element of the lockup, not
            a subtitle. */}
        <Link href="/admin" className="flex items-center gap-3 mr-4 flex-shrink-0" aria-label="Pepscore Lab Admin — Dashboard">
          <BrandLockup size="navbar" />
          <span className="font-heading text-[22px] sm:text-[25px] md:text-[28px] font-bold tracking-[0.08em] leading-none text-white/80 whitespace-nowrap">
            ADMIN
          </span>
        </Link>
        {NAV.map((group) => (
          <GroupMenu key={group.label} group={group} active={group.items.some((i) => pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href)))} />
        ))}
        <div className="ml-auto flex items-center gap-4">
          <Link href="/" className="font-heading text-[12px] font-bold tracking-[0.06em] uppercase text-white/40 hover:text-white whitespace-nowrap">
            ← Storefront
          </Link>
          <NotificationBell />
        </div>
      </div>
    </nav>
  )
}
