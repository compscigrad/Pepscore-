// GET /api/admin/customers/[id]/duplicates — weak-match candidates (name,
// company, or shipping ZIP) for the admin to review, per Decision 16: never
// auto-merged, surfaced for manual resolution only.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { getCustomer, findPossibleDuplicateCustomers } from '@/lib/customers'

interface RouteParams {
  params: Promise<{ id: string }>
}

function zipFromAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null
  const zip = (address as Record<string, unknown>).zip
  return typeof zip === 'string' ? zip : null
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const customer = await getCustomer(id)
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const matches = await findPossibleDuplicateCustomers({
    firstName: customer.firstName,
    lastName: customer.lastName,
    company: customer.company,
    shippingAddressZip: zipFromAddress(customer.shippingAddress),
    excludeCustomerId: customer.id,
  })

  return NextResponse.json(matches)
}
