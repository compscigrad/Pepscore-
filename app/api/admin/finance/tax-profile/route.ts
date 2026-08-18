import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { getBusinessTaxProfile, upsertBusinessTaxProfile } from '@/lib/finance/taxProfile'

const entityType = z.enum([
  'UNKNOWN', 'SOLE_PROPRIETORSHIP', 'SINGLE_MEMBER_LLC', 'MULTI_MEMBER_LLC_PARTNERSHIP',
  'S_CORPORATION', 'C_CORPORATION', 'OTHER_CPA_DETERMINED',
])
const accountingMethod = z.enum(['UNKNOWN', 'CASH', 'ACCRUAL'])
const taxYearType = z.enum(['CALENDAR_YEAR', 'FISCAL_YEAR'])

const updateSchema = z.object({
  legalBusinessName: z.string().trim().min(1).nullable().optional(),
  dba: z.string().trim().min(1).nullable().optional(),
  ein: z.string().trim().min(1).nullable().optional(),
  stateOfFormation: z.string().trim().min(1).nullable().optional(),
  taxYearType: taxYearType.optional(),
  entityType: entityType.optional(),
  federalTaxClassification: z.string().nullable().optional(),
  accountingMethod: accountingMethod.optional(),
  stateLocalTaxRegistrations: z.string().nullable().optional(),
  salesTaxRegistrations: z.string().nullable().optional(),
})

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  return NextResponse.json(await getBusinessTaxProfile())
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = updateSchema.parse(await req.json())
    const profile = await upsertBusinessTaxProfile(payload, userId!)
    return NextResponse.json(profile)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Tax profile update failed'
    console.error('[admin/finance/tax-profile POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
