import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { createTaxReminder, listTaxReminders } from '@/lib/finance/taxReminders'

const reminderType = z.enum([
  'FEDERAL_ESTIMATED_TAX', 'DC_ESTIMATED_TAX', 'ANNUAL_FEDERAL_FILING', 'DC_FILING',
  'SALES_TAX_FILING', 'CONTRACTOR_1099_REPORTING', 'BUSINESS_REGISTRATION_RENEWAL', 'OTHER',
])
const reminderStatus = z.enum(['NOT_CONFIGURED', 'UPCOMING', 'COMPLETED', 'OVERDUE'])

const createSchema = z.object({
  reminderType,
  dueDate: z.coerce.date().nullable().optional(),
  status: reminderStatus.optional(),
  notes: z.string().nullable().optional(),
  ownerCpaConfirmed: z.boolean().optional(),
})

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  return NextResponse.json(await listTaxReminders())
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = createSchema.parse(await req.json())
    const reminder = await createTaxReminder(payload, userId!)
    return NextResponse.json(reminder, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Tax reminder creation failed'
    console.error('[admin/finance/tax-reminders POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
