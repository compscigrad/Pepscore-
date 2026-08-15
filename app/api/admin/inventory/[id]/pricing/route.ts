import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { recalculateSuggestedPricing, setActivePricing, SpaPricingInvariantError } from '@/lib/pricing/service'

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
    // Defaults to the admin pricing page's own source so every existing
    // caller (which never sends this field) is unaffected -- an invoice
    // line's "Update Product Price" choice (Phase 3B item 3) is the one
    // other real caller today, and explicitly passes its own source.
    source: z.enum(['ADMIN_PRICING_PAGE', 'INVOICE_LINE_UPDATE_PRODUCT_PRICE']).optional(),
    reason: z.string().nullable().optional(),
  }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())
    let updated
    if ('supplierCaseCost' in payload) {
      updated = await recalculateSuggestedPricing(id, payload.supplierCaseCost)
    } else {
      // source/reason are audit-context metadata, not Product columns --
      // stripped out of the write payload itself so Prisma never sees them.
      const { source, reason, ...input } = payload
      updated = await setActivePricing(id, input, {
        actorId: userId!,
        source: source ?? 'ADMIN_PRICING_PAGE',
        reason: reason ?? input.pricingOverrideReason ?? null,
      })
    }

    return NextResponse.json(updated)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof SpaPricingInvariantError) {
      // Surfaced verbatim so the admin UI can offer the proposed corrected
      // SPA as a one-click fix, or let the admin type a different lower
      // value -- never silently written either way.
      return NextResponse.json(
        { error: err.message, standardCasePrice: err.standardCasePrice, currentSpaCasePrice: err.currentSpaCasePrice, proposedSpaCasePrice: err.proposedSpaCasePrice },
        { status: 400 }
      )
    }
    const message = err instanceof Error ? err.message : 'Pricing update failed'
    console.error('[admin/inventory/:id/pricing PATCH]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
