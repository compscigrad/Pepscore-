import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { recordInventoryPurchase, listInventoryPurchases } from '@/lib/finance/inventoryPurchases'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

const createSchema = z.object({
  productId: z.string().min(1),
  supplier: z.string().trim().min(1).nullable().optional(),
  sku: z.string().trim().min(1).nullable().optional(),
  quantity: z.number().int().positive(),
  caseQuantity: z.number().int().positive().nullable().optional(),
  unitCost: z.number().min(0),
  receiptUrl: z.string().url().nullable().optional(),
  invoiceRef: z.string().trim().min(1).nullable().optional(),
  receivedAt: z.coerce.date(),
  notes: z.string().nullable().optional(),
  recordPhysicalStock: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const productId = searchParams.get('productId')

  const purchases = await listInventoryPurchases({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    productId: productId ?? undefined,
  })
  return NextResponse.json(purchases)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = createSchema.parse(await req.json())
    const purchase = await recordInventoryPurchase(payload, userId!)
    return NextResponse.json(purchase, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Inventory purchase failed'
    console.error('[admin/finance/inventory-purchases POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
