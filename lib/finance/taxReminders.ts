// Tax deadline / estimated-tax reminders (2026-08-18 Finance Center
// sprint). Status always defaults to NOT_CONFIGURED and is only ever
// admin-set -- this module never infers "legally required" or "overdue"
// from a date on its own, matching the spec's explicit requirement that
// the software must never assert a filing obligation.
import { prisma } from '@/lib/prisma'
import type { TaxReminder, TaxReminderType, TaxReminderStatus } from '@prisma/client'

export interface CreateTaxReminderInput {
  reminderType: TaxReminderType
  dueDate?: Date | null
  status?: TaxReminderStatus
  notes?: string | null
  ownerCpaConfirmed?: boolean
}

export async function createTaxReminder(input: CreateTaxReminderInput, actorId: string): Promise<TaxReminder> {
  const reminder = await prisma.taxReminder.create({ data: { ...input, createdBy: actorId } })
  await prisma.adminAuditLog.create({
    data: { action: 'TAX_REMINDER_CREATED', entity: 'TaxReminder', entityId: reminder.id, adminId: actorId, details: { reminderType: reminder.reminderType, status: reminder.status } },
  })
  return reminder
}

export async function updateTaxReminder(id: string, input: Partial<CreateTaxReminderInput>, actorId: string): Promise<TaxReminder> {
  const reminder = await prisma.taxReminder.update({ where: { id }, data: input })
  await prisma.adminAuditLog.create({
    data: { action: 'TAX_REMINDER_UPDATED', entity: 'TaxReminder', entityId: id, adminId: actorId, details: input as never },
  })
  return reminder
}

export async function listTaxReminders(): Promise<TaxReminder[]> {
  return prisma.taxReminder.findMany({ orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] })
}
