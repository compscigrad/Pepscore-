// GET/PATCH /api/admin/promotions/first-order-offer — the FIRST10 offer's
// full admin-editable config (enabled/percentage/eligibility/expiration/
// stackability). See components/admin/FirstOrderOfferConfigForm.tsx.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  getFirstOrderOfferConfig,
  updateFirstOrderOfferConfig,
  InvalidFirstOrderOfferConfigError,
} from '@/lib/promotions/firstOrderOffer'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  percentage: z.number().positive().max(100).optional(),
  eligibleProductSlugs: z.array(z.string().trim().min(1)).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  stackable: z.boolean().optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const config = await getFirstOrderOfferConfig()
  return NextResponse.json(config)
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = patchSchema.parse(body)

    const config = await updateFirstOrderOfferConfig({
      enabled: parsed.enabled,
      percentage: parsed.percentage,
      eligibleProductSlugs: parsed.eligibleProductSlugs,
      expiresAt: parsed.expiresAt === undefined ? undefined : parsed.expiresAt === null ? null : new Date(parsed.expiresAt),
      stackable: parsed.stackable,
      updatedBy: userId!,
    })

    await prisma.adminAuditLog.create({
      data: { action: 'UPDATE_FIRST_ORDER_OFFER_CONFIG', entity: 'FirstOrderOfferConfig', entityId: 'singleton', adminId: userId!, details: parsed },
    })

    return NextResponse.json(config)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof InvalidFirstOrderOfferConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/promotions/first-order-offer PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
