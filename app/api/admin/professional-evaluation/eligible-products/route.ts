// GET /api/admin/professional-evaluation/eligible-products -- products an
// admin may currently issue an evaluation unit for (Product.evaluationEligible).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const products = await prisma.product.findMany({
    where: { evaluationEligible: true, pricingStatus: { not: 'INACTIVE' } },
    select: { id: true, name: true, size: true, evaluationMethod: true },
    orderBy: [{ name: 'asc' }, { size: 'asc' }],
  })
  return NextResponse.json({ products })
}
