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
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    ],
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
    ],
  },
]

function GroupMenu({ group, active }: { group: NavGroup; active: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`font-heading text-[12px] font-bold tracking-[0.06em] uppercase px-3 py-2 rounded-lg transition-colors ${
          active ? 'text-gold bg-white/[0.06]' : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
        }`}
      >
        {group.label}
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-1 z-50 min-w-[220px]">
          <div className="bg-[#141414] border border-white/10 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1.5 overflow-hidden">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-4 py-2.5 text-[13px] text-white/75 hover:text-gold hover:bg-white/[0.04] whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav className="sticky top-0 z-[80] bg-black border-b border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-[52px] flex items-center gap-1 overflow-x-auto">
        <Link href="/admin" className="font-heading text-[13px] font-extrabold text-white mr-4 whitespace-nowrap">
          Pepscore <span className="text-gold">Lab</span> <span className="text-white/40 font-semibold">Admin</span>
        </Link>
        {NAV.map((group) => (
          <GroupMenu key={group.label} group={group} active={group.items.some((i) => pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href)))} />
        ))}
        <div className="ml-auto">
          <Link href="/" className="font-heading text-[12px] font-bold tracking-[0.06em] uppercase text-white/40 hover:text-white whitespace-nowrap">
            ← Storefront
          </Link>
        </div>
      </div>
    </nav>
  )
}
