// Single entry point for firing an admin notification — creates the
// Notification row (the source of truth the dashboard/bell reads) and fans
// it out to every configured channel. Dashboard delivery is unconditional;
// email/SMS each filter recipients by their own enabled flag.
import { prisma } from '@/lib/prisma'
import { dashboardChannel } from './channels/dashboard'
import { emailChannel } from './channels/email'
import { smsChannel } from './channels/sms'
import type { IntakeNotificationPayload } from './types'

export interface NotifyIntakeSubmittedInput {
  invoiceId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  isNewCustomer: boolean
  possibleDuplicateOf?: string | null
}

export async function notifyIntakeSubmitted(input: NotifyIntakeSubmittedInput): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      type: 'INTAKE_SUBMITTED',
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      isNewCustomer: input.isNewCustomer,
      possibleDuplicateOf: input.possibleDuplicateOf ?? undefined,
    },
  })

  const payload: IntakeNotificationPayload = {
    notificationId: notification.id,
    customerId: input.customerId,
    customerName: input.customerName,
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    isNewCustomer: input.isNewCustomer,
    possibleDuplicateOf: input.possibleDuplicateOf,
    submittedAt: notification.createdAt,
  }

  const recipients = await prisma.adminNotificationRecipient.findMany()

  await Promise.all([
    dashboardChannel.send(payload, recipients),
    emailChannel.send(payload, recipients),
    smsChannel.send(payload, recipients),
  ])
}
