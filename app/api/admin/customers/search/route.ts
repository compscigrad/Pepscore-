// GET /api/admin/customers/search?q=... -- admin-only predictive customer
// lookup (2026-08-17, admin customer search checkpoint). Backs
// components/admin/AdminCustomerSearch.tsx. Wraps the existing
// lib/customers.ts listCustomers({ search }), which already matches
// firstName/lastName/company/email/phone (with flexible phone-format
// matching) -- this route adds nothing new to the matching logic itself,
// only an admin-gated, minimal-field HTTP surface for it.
//
// Returns only what's needed to tell two records apart in a dropdown
// (name, email, phone, company, portal-link status) -- never billing/
// shipping address, payment methods, notes, or activity history. The full
// record is one click away at /admin/customers/[id], which already has
// its own requireAdmin() gate.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { listCustomers } from '@/lib/customers'
import { formatPhoneDisplay } from '@/lib/invoice/format'

const MAX_RESULTS = 8

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ customers: [] })

  const { customers } = await listCustomers({ search: q, limit: MAX_RESULTS, sortBy: 'name' })

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone ? formatPhoneDisplay(c.phone) : null,
      company: c.company,
      hasPortalAccess: !!c.userId && !c.portalAccessDisabled,
    })),
  })
}
