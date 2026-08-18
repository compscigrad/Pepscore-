import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { getForm1099KReconciliationReport, upsertForm1099KRecord } from '@/lib/finance/form1099k'

const updateSchema = z.object({
  taxYear: z.number().int().min(2020).max(2100),
  processorReportedGross: z.number().min(0).nullable(),
  notes: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const taxYear = Number(searchParams.get('taxYear')) || new Date().getFullYear()
  return NextResponse.json(await getForm1099KReconciliationReport(taxYear))
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = updateSchema.parse(await req.json())
    const record = await upsertForm1099KRecord(payload.taxYear, payload.processorReportedGross, payload.notes ?? null, userId!)
    return NextResponse.json(record)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : '1099-K record update failed'
    console.error('[admin/finance/1099k POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
