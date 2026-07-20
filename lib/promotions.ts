// Data access for reusable discount templates (Promotion). Small enough not
// to need its own subfolder, but kept separate from lib/invoices.ts since
// promotions are a standalone catalog, not invoice-scoped data.
import { prisma } from '@/lib/prisma'

export async function listPromotions(activeOnly = true) {
  return prisma.promotion.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
  })
}

export interface CreatePromotionInput {
  name: string
  description?: string
  type: 'FIXED' | 'PERCENTAGE'
  amount: number
}

export async function createPromotion(input: CreatePromotionInput) {
  return prisma.promotion.create({ data: input })
}
