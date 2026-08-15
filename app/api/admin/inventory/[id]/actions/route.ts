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
import { reconcileInventory, correctUnitsPerCase } from '@/lib/inventory/corrections'
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
  // Catalog/inventory-level backorder configuration (Phase 2B correction,
  // 2026-08-07) -- distinct from BackorderCondition (an invoice line's own
  // fulfillment-shortage record). Changes storefront-facing availability
  // (lib/storefront/availability.ts) without a code deployment.
  z.object({ action: z.literal('SET_BACKORDER_ENABLED'), backorderEnabled: z.boolean() }),
  // Owner-controlled merchandising label (2026-08-15) -- product-family
  // level, not per-strength: the handler below writes this to every
  // Product row sharing the edited row's name, not just `id`.
  z.object({ action: z.literal('SET_MERCHANDISING_STATUS'), merchandisingStatus: z.enum(['NONE', 'POPULAR', 'BEST_SELLER']) }),
  // Discrepancy-correction actions -- distinct from the routine actions
  // above in that they always require a reason, and RECONCILE fixes the
  // reservedUnits cache against the actual sum of ACTIVE reservations
  // rather than touching physical stock at all.
  z.object({ action: z.literal('RECONCILE'), reason: z.string().optional() }),
  z.object({ action: z.literal('CORRECT_UNITS_PER_CASE'), unitsPerCase: z.number().int().positive().nullable(), reason: z.string().min(1) }),
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
      case 'SET_BACKORDER_ENABLED':
        result = await prisma.product.update({ where: { id }, data: { backorderEnabled: payload.backorderEnabled } })
        await prisma.adminAuditLog.create({
          data: {
            action: 'SET_PRODUCT_BACKORDER_ENABLED',
            entity: 'Product',
            entityId: id,
            adminId: actor,
            details: { backorderEnabled: payload.backorderEnabled },
          },
        })
        break
      case 'SET_MERCHANDISING_STATUS': {
        // Product-family-wide write (not just this row) -- Semaglutide
        // 30mg and Semaglutide 5mg must never disagree on this, and the
        // owner explicitly does not want to tag every strength by hand.
        const target = await prisma.product.findUniqueOrThrow({ where: { id }, select: { name: true } })
        result = await prisma.product.updateMany({ where: { name: target.name }, data: { merchandisingStatus: payload.merchandisingStatus } })
        await prisma.adminAuditLog.create({
          data: {
            action: 'SET_PRODUCT_MERCHANDISING_STATUS',
            entity: 'Product',
            entityId: id,
            adminId: actor,
            details: { name: target.name, merchandisingStatus: payload.merchandisingStatus },
          },
        })
        break
      }
      case 'RECONCILE':
        result = await reconcileInventory(id, actor, payload.reason)
        break
      case 'CORRECT_UNITS_PER_CASE':
        result = await correctUnitsPerCase(id, payload.unitsPerCase, actor, payload.reason)
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
