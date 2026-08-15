// GET/PATCH /api/admin/promotions/first-order-offer — the FIRST10 master
// on/off switch only. Percentage/eligibility/expiration/stackability now
// live on the active default first-order PromotionCampaign, managed at
// Admin -> Promotions (/admin/promotions) instead of here -- see
// docs/Decisions.md for the migration reasoning.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getFirstOrderOfferConfig, updateFirstOrderOfferConfig } from '@/lib/promotions/firstOrderOffer'

const patchSchema = z.object({
  enabled: z.boolean(),
})

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const config = await getFirstOrderOfferConfig()
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = patchSchema.parse(body)

    const config = await updateFirstOrderOfferConfig({ enabled: parsed.enabled, updatedBy: userId! })

    await prisma.adminAuditLog.create({
      data: { action: 'UPDATE_FIRST_ORDER_OFFER_CONFIG', entity: 'FirstOrderOfferConfig', entityId: 'singleton', adminId: userId!, details: parsed },
    })

    return NextResponse.json(config)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/promotions/first-order-offer PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
