import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { createExpense, listExpenses } from '@/lib/finance/expenses'

const financeExpenseCategory = z.enum([
  'SHIPPING_POSTAGE', 'PACKAGING_FULFILLMENT', 'INVENTORY_PRODUCT_PURCHASES', 'RESEARCH_FULFILLMENT_SUPPLIES',
  'PAYMENT_PROCESSING', 'SOFTWARE_TECHNOLOGY', 'ADMINISTRATIVE_COMPLIANCE', 'PROFESSIONAL_SERVICES',
  'ADVERTISING_MARKETING', 'OFFICE_SUPPLIES', 'EQUIPMENT_ASSETS', 'PHILANTHROPY_DONATIONS', 'OTHER_NEEDS_REVIEW',
])
const financeAccountingTreatment = z.enum([
  'OPERATING_EXPENSE', 'INVENTORY_COGS', 'CONTRA_REVENUE', 'ASSET_CAPITAL_EXPENSE', 'CHARITABLE_SEPARATE_TREATMENT', 'NEEDS_ACCOUNTANT_REVIEW',
])

const createSchema = z.object({
  date: z.coerce.date(),
  vendor: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1),
  amount: z.number().min(0),
  category: financeExpenseCategory,
  subcategory: z.string().trim().min(1).nullable().optional(),
  paymentMethod: z.string().trim().min(1).nullable().optional(),
  businessPurpose: z.string().trim().min(1).nullable().optional(),
  orderId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  shipmentId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  taxTreatment: financeAccountingTreatment.optional(),
  receiptUrl: z.string().url().nullable().optional(),
  receiptFilename: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')
  const taxTreatment = searchParams.get('taxTreatment')
  const query = searchParams.get('q')

  const parsedCategory = category ? financeExpenseCategory.safeParse(category) : undefined
  const parsedTreatment = taxTreatment ? financeAccountingTreatment.safeParse(taxTreatment) : undefined

  const expenses = await listExpenses({
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    category: parsedCategory?.success ? parsedCategory.data : undefined,
    taxTreatment: parsedTreatment?.success ? parsedTreatment.data : undefined,
    query: query ?? undefined,
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const payload = createSchema.parse(await req.json())
    const expense = await createExpense(payload, userId!)
    return NextResponse.json(expense, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Expense creation failed'
    console.error('[admin/finance/expenses POST]', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
