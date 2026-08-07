// Read-only view of backordered inventory, for the admin Inventory page and
// dashboard. Backorders themselves are still created/resolved exclusively
// through lib/backorders.ts's applyBackorder/resolveBackorder (the existing
// compensation-aware admin workflow) -- this module never writes a
// BackorderCondition, it only summarizes what's already there.
import { prisma } from '@/lib/prisma'

export async function getActiveBackorderedVials(productId: string): Promise<number> {
  const conditions = await prisma.backorderCondition.findMany({
    where: { productId, status: 'ACTIVE' },
    select: { vialsBackordered: true },
  })
  return conditions.reduce((sum, c) => sum + (c.vialsBackordered ?? 0), 0)
}

export async function getActiveBackorderedVialsByProduct(): Promise<Map<string, number>> {
  const conditions = await prisma.backorderCondition.findMany({
    where: { status: 'ACTIVE', productId: { not: null } },
    select: { productId: true, vialsBackordered: true },
  })
  const map = new Map<string, number>()
  for (const c of conditions) {
    if (!c.productId) continue
    map.set(c.productId, (map.get(c.productId) ?? 0) + (c.vialsBackordered ?? 0))
  }
  return map
}
