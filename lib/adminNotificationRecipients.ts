// Data access for AdminNotificationRecipient — a list, not a singleton, so
// multiple administrators can each configure their own email/SMS delivery.
// Managed entirely through Settings -> Admin Notifications; nothing here is
// ever a literal phone/email in code.
import { prisma } from '@/lib/prisma'

export interface AdminNotificationRecipientInput {
  name?: string | null
  email?: string | null
  phone?: string | null
  emailEnabled?: boolean
  smsEnabled?: boolean
}

export async function listAdminNotificationRecipients() {
  return prisma.adminNotificationRecipient.findMany({ orderBy: { createdAt: 'asc' } })
}

export async function createAdminNotificationRecipient(input: AdminNotificationRecipientInput) {
  return prisma.adminNotificationRecipient.create({
    data: {
      name: input.name || undefined,
      email: input.email || undefined,
      phone: input.phone || undefined,
      emailEnabled: input.emailEnabled ?? true,
      smsEnabled: input.smsEnabled ?? false,
    },
  })
}

export async function updateAdminNotificationRecipient(id: string, input: AdminNotificationRecipientInput) {
  return prisma.adminNotificationRecipient.update({
    where: { id },
    data: {
      name: input.name === undefined ? undefined : input.name || null,
      email: input.email === undefined ? undefined : input.email || null,
      phone: input.phone === undefined ? undefined : input.phone || null,
      emailEnabled: input.emailEnabled,
      smsEnabled: input.smsEnabled,
    },
  })
}

export async function deleteAdminNotificationRecipient(id: string): Promise<void> {
  await prisma.adminNotificationRecipient.delete({ where: { id } })
}
