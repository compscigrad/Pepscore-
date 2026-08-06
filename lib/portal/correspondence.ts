// Customer-facing correspondence read — reuses the authoritative
// Communication model (same table the admin CorrespondenceHistory reads),
// filtered through the same isCustomerVisibleCategory() allowlist the
// dashboard already uses, so there is exactly one definition of "what a
// customer is allowed to see" across the whole portal.
import { prisma } from '@/lib/prisma'
import { isCustomerVisibleCategory } from '@/lib/notifications/routing'

export interface PortalCorrespondenceEntry {
  id: string
  channel: string
  category: string
  subject: string | null
  body: string
  invoiceNumber: string | null
  sentAt: Date
}

export async function listPortalCorrespondence(customerId: string): Promise<PortalCorrespondenceEntry[]> {
  const communications = await prisma.communication.findMany({
    where: { customerId },
    orderBy: { sentAt: 'desc' },
    take: 100,
    include: { invoice: { select: { invoiceNumber: true } } },
  })

  return communications
    .filter((c) => isCustomerVisibleCategory(c.category))
    .map((c) => ({
      id: c.id,
      channel: c.channel,
      category: c.category,
      subject: c.subject,
      body: c.body,
      invoiceNumber: c.invoice?.invoiceNumber ?? null,
      sentAt: c.sentAt,
    }))
}
