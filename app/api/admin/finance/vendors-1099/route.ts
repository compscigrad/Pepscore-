import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { createVendor1099, listVendors1099WithPayments } from '@/lib/finance/vendors1099'

const payeeType = z.enum(['UNKNOWN', 'BUSINESS', 'INDIVIDUAL'])
const reviewStatus = z.enum(['UNREVIEWED', 'REVIEWED', 'FILED', 'NOT_APPLICABLE'])

const createSchema = z.object({
  vendorName: z.string().trim().min(1),
  payeeType: payeeType.optional(),
  w9Received: z.boolean().optional(),
  tinLast4: z.string().regex(/^\d{4}$/).nullable().optional(),
  reviewStatus: reviewStatus.optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  return NextResponse.json(await listVendors1099WithPayments(year))
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = createSchema.parse(await req.json())
    const vendor = await createVendor1099(payload, userId!)
    return NextResponse.json(vendor, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Vendor creation failed'
    console.error('[admin/finance/vendors-1099 POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
