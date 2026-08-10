// GET    /api/admin/promotion-campaigns/[id]        — read one campaign
// PATCH  /api/admin/promotion-campaigns/[id]         — edit fields, or an action: activate | retire | archive
// DELETE /api/admin/promotion-campaigns/[id]         — safe hard delete (unused campaigns only)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import {
  getPromotionCampaign,
  updatePromotionCampaign,
  activateDefaultFirstOrderCampaign,
  retirePromotionCampaign,
  archivePromotionCampaign,
  deletePromotionCampaignIfUnused,
  PromotionCampaignError,
  PromotionCampaignHasHistoryError,
} from '@/lib/promotions/campaigns'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const updateSchema = z.object({
  action: z.undefined(),
  name: z.string().min(1).optional(),
  publicTitle: z.string().min(1).optional(),
  publicDescription: z.string().nullable().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  discountValue: z.number().positive().optional(),
  stackingPolicy: z.enum(['NOT_STACKABLE', 'STACKABLE_WITH_ONE', 'PRIVILEGED_STACKABLE']).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  eligibleProductSlugs: z.array(z.string()).optional(),
  excludedProductSlugs: z.array(z.string()).optional(),
  minPurchaseAmount: z.number().nonnegative().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  usesPerCustomer: z.number().int().positive().optional(),
})

const activateSchema = z.object({
  action: z.literal('activate'),
  outstandingCodePolicy: z.enum(['HONOR', 'EXPIRE_NOW']),
})

const lifecycleActionSchema = z.object({
  action: z.enum(['retire', 'archive']),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const campaign = await getPromotionCampaign(id)
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const body = await req.json()

    if (body.action === 'activate') {
      const payload = activateSchema.parse(body)
      const result = await activateDefaultFirstOrderCampaign(id, {
        actorId: userId as string,
        outstandingCodePolicy: payload.outstandingCodePolicy,
      })
      return NextResponse.json(result)
    }
    if (body.action === 'retire' || body.action === 'archive') {
      const payload = lifecycleActionSchema.parse(body)
      const campaign =
        payload.action === 'retire'
          ? await retirePromotionCampaign(id, userId as string)
          : await archivePromotionCampaign(id, userId as string)
      return NextResponse.json(campaign)
    }

    const payload = updateSchema.parse(body)
    const campaign = await updatePromotionCampaign(id, {
      ...payload,
      startsAt: payload.startsAt === undefined ? undefined : payload.startsAt ? new Date(payload.startsAt) : null,
      expiresAt: payload.expiresAt === undefined ? undefined : payload.expiresAt ? new Date(payload.expiresAt) : null,
      updatedBy: userId as string,
    })
    return NextResponse.json(campaign)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof PromotionCampaignError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/promotion-campaigns/[id] PATCH]', err)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    await deletePromotionCampaignIfUnused(id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof PromotionCampaignHasHistoryError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/promotion-campaigns/[id] DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
