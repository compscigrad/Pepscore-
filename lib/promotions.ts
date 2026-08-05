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

export interface UpdatePromotionInput {
  name?: string
  description?: string | null
  type?: 'FIXED' | 'PERCENTAGE'
  amount?: number
  active?: boolean
}

// Editing (including deactivating/reactivating) only ever touches this
// catalog row — every invoice that has already applied this preset holds
// its own InvoiceDiscount snapshot (label/type/amount), so a change here
// never rewrites a historical invoice. See prisma/schema.prisma's
// InvoiceDiscount comment.
export async function updatePromotion(id: string, input: UpdatePromotionInput) {
  return prisma.promotion.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description === null ? null : input.description || undefined,
      type: input.type,
      amount: input.amount,
      active: input.active,
    },
  })
}

export class PromotionInUseError extends Error {}

// Permanent delete is only ever safe for a preset that's never actually
// been applied to an invoice — anything else must be deactivated instead,
// which hides it from "Apply Promotion..." without touching the historical
// InvoiceDiscount snapshots that reference it.
export async function deletePromotion(id: string): Promise<void> {
  const usageCount = await prisma.invoiceDiscount.count({ where: { promotionId: id } })
  if (usageCount > 0) {
    throw new PromotionInUseError(
      `This preset has been used on ${usageCount} invoice${usageCount === 1 ? '' : 's'} and can't be permanently deleted — deactivate it instead.`
    )
  }
  await prisma.promotion.delete({ where: { id } })
}
