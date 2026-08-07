// Every manual inventory-entry action the admin Inventory page exposes,
// behind one endpoint keyed by `action` so each is unmistakably a distinct,
// named operation (matching the six buttons the UI shows) rather than a
// generic "adjust quantity" call that hides what actually happened.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import {
  enableInventoryTracking,
  initializeInventory,
  addStock,
  removeStock,
  recordDamageLoss,
  setExactCount,
  reverseLastAdjustment,
} from '@/lib/inventory/actions'
import { prisma } from '@/lib/prisma'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ENABLE_TRACKING') }),
  z.object({ action: z.literal('INITIALIZE'), quantity: z.number().int().min(0), notes: z.string().optional() }),
  z.object({ action: z.literal('ADD_STOCK'), quantity: z.number().int().positive(), reason: z.string().optional(), notes: z.string().optional() }),
  z.object({ action: z.literal('REMOVE_STOCK'), quantity: z.number().int().positive(), reason: z.string().optional(), notes: z.string().optional() }),
  z.object({ action: z.literal('SET_EXACT_COUNT'), quantity: z.number().int().min(0), reason: z.string().optional(), notes: z.string().optional() }),
  z.object({ action: z.literal('DAMAGE_LOSS'), quantity: z.number().int().positive(), reason: z.string().optional(), notes: z.string().optional() }),
  z.object({ action: z.literal('REVERSE_LAST'), notes: z.string().optional() }),
  z.object({
    action: z.literal('SET_THRESHOLDS'),
    unitsPerCase: z.number().int().positive().nullable().optional(),
    lowStockThreshold: z.number().int().min(0).nullable().optional(),
  }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = actionSchema.parse(await req.json())
    const actor = userId!

    let result: unknown
    switch (payload.action) {
      case 'ENABLE_TRACKING':
        result = await enableInventoryTracking(id)
        break
      case 'INITIALIZE':
        result = await initializeInventory(id, payload.quantity, actor, payload.notes)
        break
      case 'ADD_STOCK':
        result = await addStock(id, payload.quantity, actor, payload.reason, payload.notes)
        break
      case 'REMOVE_STOCK':
        result = await removeStock(id, payload.quantity, actor, payload.reason, payload.notes)
        break
      case 'SET_EXACT_COUNT':
        result = await setExactCount(id, payload.quantity, actor, payload.reason, payload.notes)
        break
      case 'DAMAGE_LOSS':
        result = await recordDamageLoss(id, payload.quantity, actor, payload.reason, payload.notes)
        break
      case 'REVERSE_LAST':
        result = await reverseLastAdjustment(id, actor, payload.notes)
        break
      case 'SET_THRESHOLDS':
        result = await prisma.product.update({
          where: { id },
          data: { unitsPerCase: payload.unitsPerCase, lowStockThreshold: payload.lowStockThreshold },
        })
        break
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Inventory action failed'
    console.error('[admin/inventory/:id/actions POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
