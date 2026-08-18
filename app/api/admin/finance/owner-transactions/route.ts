import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { createOwnerTransaction, listOwnerTransactions } from '@/lib/finance/ownerTransactions'

const ownerTransactionType = z.enum(['CONTRIBUTION', 'DISTRIBUTION', 'REIMBURSEMENT', 'OWNER_PAID_EXPENSE'])

const createSchema = z.object({
  type: ownerTransactionType,
  amount: z.number().min(0),
  date: z.coerce.date(),
  description: z.string().trim().min(1),
  sourceReference: z.string().trim().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const type = searchParams.get('type')
  const parsedType = type ? ownerTransactionType.safeParse(type) : undefined

  const transactions = await listOwnerTransactions({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    type: parsedType?.success ? parsedType.data : undefined,
  })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = createSchema.parse(await req.json())
    const transaction = await createOwnerTransaction(payload, userId!)
    return NextResponse.json(transaction, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Owner transaction creation failed'
    console.error('[admin/finance/owner-transactions POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
