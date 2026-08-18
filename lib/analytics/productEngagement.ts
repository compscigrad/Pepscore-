// AI-1.2 -- writes to ProductEngagementEvent. Follows the same convention
// as every other audit-log write in this codebase (not independently
// DB-tested in the fast unit suite; see lib/invoice/numbering.test.ts's
// precedent). Called from app/api/analytics/product-engagement/route.ts,
// the only writer -- never call prisma.productEngagementEvent directly
// from anywhere else, so this stays the single validated entry point.
import { prisma } from '@/lib/prisma'
import type { ProductEngagementEventType } from '@prisma/client'

export interface LogProductEngagementParams {
  productId: string
  productName: string
  category?: string | null
  eventType: ProductEngagementEventType
}

export async function logProductEngagement(params: LogProductEngagementParams): Promise<void> {
  try {
    await prisma.productEngagementEvent.create({ data: params })
  } catch {
    // Best-effort only.
  }
}
