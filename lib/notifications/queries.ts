// Admin-facing reads/writes for the Notification list — separate from
// dispatch.ts (which only ever creates rows) since these are the dashboard
// bell's read/mark-read side.
import { prisma } from '@/lib/prisma'

export async function listNotifications(unreadOnly = false) {
  return prisma.notification.findMany({
    where: unreadOnly ? { read: false } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  })
}

export async function markNotificationRead(id: string) {
  return prisma.notification.update({ where: { id }, data: { read: true, readAt: new Date() } })
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { read: false },
    data: { read: true, readAt: new Date() },
  })
  return { count: result.count }
}
