import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { recalculateSuggestedPricing, setActivePricing } from '@/lib/pricing/service'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

// Two distinct write paths, deliberately not merged into one schema:
// changing supplierCaseCost only ever recalculates the suggested* columns
// (never touches what's actually charged); everything else here is an
// explicit "this is what we charge/allow now" admin decision.
const patchSchema = z.union([
  z.object({ supplierCaseCost: z.number().min(0) }),
  z.object({
    activeStandardCasePrice: z.number().min(0).nullable().optional(),
    activeSpaCasePrice: z.number().min(0).nullable().optional(),
    activeBulkPrice: z.number().min(0).nullable().optional(),
    activeIndividualVialPrice: z.number().min(0).nullable().optional(),
    individualSalesEnabled: z.boolean().optional(),
    manualPricingOverride: z.boolean().optional(),
    pricingOverrideReason: z.string().nullable().optional(),
    pricingNotes: z.string().nullable().optional(),
    unitsPerCase: z.number().int().positive().nullable().optional(),
    sku: z.string().nullable().optional(),
    pricingStatus: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())
    const updated =
      'supplierCaseCost' in payload
        ? await recalculateSuggestedPricing(id, payload.supplierCaseCost)
        : await setActivePricing(id, payload, { actorId: userId!, source: 'ADMIN_PRICING_PAGE', reason: payload.pricingOverrideReason ?? null })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Pricing update failed'
    console.error('[admin/inventory/:id/pricing PATCH]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
