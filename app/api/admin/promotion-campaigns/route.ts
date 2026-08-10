// GET  /api/admin/promotion-campaigns — list campaigns (optionally filtered by status)
// POST /api/admin/promotion-campaigns — create a new campaign (always starts DRAFT/SCHEDULED)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { listPromotionCampaigns, createPromotionCampaign, PromotionCampaignError } from '@/lib/promotions/campaigns'
import type { PromotionCampaignStatus } from '@prisma/client'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const STATUS_VALUES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED', 'ARCHIVED'] as const

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Internal campaign name is required'),
  publicTitle: z.string().min(1, 'Public offer title is required'),
  publicDescription: z.string().optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']),
  discountValue: z.number().positive('Discount value must be greater than 0'),
  firstOrderOnly: z.boolean().optional(),
  stackingPolicy: z.enum(['NOT_STACKABLE', 'STACKABLE_WITH_ONE', 'PRIVILEGED_STACKABLE']).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  eligibleProductSlugs: z.array(z.string()).optional(),
  excludedProductSlugs: z.array(z.string()).optional(),
  minPurchaseAmount: z.number().nonnegative().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
  usesPerCustomer: z.number().int().positive().optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const statusParam = req.nextUrl.searchParams.get('status')
  const status = statusParam
    ? (statusParam.split(',').filter((s): s is PromotionCampaignStatus => (STATUS_VALUES as readonly string[]).includes(s)) as PromotionCampaignStatus[])
    : undefined
  const campaigns = await listPromotionCampaigns(status && status.length > 0 ? { status } : undefined)
  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const payload = createCampaignSchema.parse(body)
    const campaign = await createPromotionCampaign({
      ...payload,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      createdBy: userId as string,
    })
    return NextResponse.json(campaign, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof PromotionCampaignError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/promotion-campaigns POST]', err)
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  }
}
