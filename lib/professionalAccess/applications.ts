// Professional Access application intake + admin review queue (2026-08-19
// Professional Access sprint, sections 10-11). Extends the existing
// lead-capture architecture rather than replacing it -- every application
// also creates a real LeadCapture row (interestType
// PROFESSIONAL_ACCESS_INQUIRY) via captureLead(), so it stays visible in
// the existing Admin CRM/Leads views exactly like every other inquiry
// type, while ProfessionalAccessApplication below carries the actual
// review-queue state (PENDING/APPROVED/REJECTED/MORE_INFO_REQUESTED/
// REVOKED) that LeadCapture was never designed to hold.
import { prisma } from '@/lib/prisma'
import { captureLead } from '@/lib/leads/service'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import {
  professionalAccessApplicationReceivedSubject,
  buildProfessionalAccessApplicationReceivedHtml,
  professionalAccessMoreInfoRequestedSubject,
  buildProfessionalAccessMoreInfoRequestedHtml,
  professionalAccessApprovedSubject,
  buildProfessionalAccessApprovedHtml,
  professionalAccessRejectedSubject,
  buildProfessionalAccessRejectedHtml,
} from '@/emails/ProfessionalAccess'
import { leadCapturedSubject, buildLeadCapturedHtml } from '@/emails/LeadCaptured'
import { CONTACT_EMAIL } from '@/lib/resend'
import type { ProfessionalAccessApplication, ProfessionalAccessStatus } from '@prisma/client'

export class ProfessionalAccessApplicationError extends Error {}

export interface SubmitApplicationInput {
  contactName: string
  businessName: string
  businessEmail: string
  phone?: string | null
  website?: string | null
  businessType?: string | null
  businessAddress?: { street1?: string; city?: string; state?: string; zip?: string; country?: string } | null
  jurisdiction?: string | null
  registrationInfo?: string | null
  purposeDescription?: string | null
  expectedVolume?: string | null
  sourcePage: string
  referrer?: string | null
  landingUrl?: string | null
  consent: boolean
}

// Standard-rate limited at the API route layer (same convention as every
// other public intake endpoint, see app/api/leads/route.ts). One
// application per submission -- a repeat application from the same
// email/phone links to the same Customer (via captureLead's
// upsertCustomerFromIntake) but always creates a NEW
// ProfessionalAccessApplication row rather than silently overwriting a
// prior one, so review history for a customer who reapplies after a
// rejection stays intact.
export async function submitProfessionalAccessApplication(input: SubmitApplicationInput): Promise<ProfessionalAccessApplication> {
  const { lead, customer, isNewCustomer } = await captureLead({
    name: input.contactName,
    email: input.businessEmail,
    phone: input.phone,
    interestType: 'PROFESSIONAL_ACCESS_INQUIRY',
    message: input.purposeDescription,
    sourcePage: input.sourcePage,
    referrer: input.referrer,
    landingUrl: input.landingUrl,
    consent: input.consent,
  })

  const application = await prisma.professionalAccessApplication.create({
    data: {
      customerId: customer.id,
      contactName: input.contactName,
      businessName: input.businessName,
      businessEmail: input.businessEmail,
      phone: input.phone ?? undefined,
      website: input.website ?? undefined,
      businessType: input.businessType ?? undefined,
      businessAddress: input.businessAddress ?? undefined,
      jurisdiction: input.jurisdiction ?? undefined,
      registrationInfo: input.registrationInfo ?? undefined,
      purposeDescription: input.purposeDescription ?? undefined,
      expectedVolume: input.expectedVolume ?? undefined,
    },
  })

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'PROFESSIONAL_ACCESS_APPLICATION_SUBMITTED',
    newValue: application.id,
    source: 'SYSTEM',
  })

  // Applicant acknowledgment -- best-effort, never blocks the submission
  // itself, matching every other notification-send call site's discipline.
  await sendCategorizedEmail(
    {
      category: 'PROFESSIONAL_ACCESS_APPLICATION_RECEIVED',
      to: input.businessEmail,
      subject: professionalAccessApplicationReceivedSubject(),
      html: buildProfessionalAccessApplicationReceivedHtml({ contactName: input.contactName, businessName: input.businessName }),
    },
    { customerId: customer.id, actorType: 'SYSTEM' }
  )

  // Admin notification -- reuses the same LeadCaptured template every other
  // inquiry type already sends, so this application also shows up in the
  // admin's existing inbox habit, not a second, disconnected alert system.
  await sendCategorizedEmail(
    {
      category: 'PROFESSIONAL_ACCESS_APPLICATION_ALERT',
      to: CONTACT_EMAIL,
      subject: leadCapturedSubject({ name: input.contactName, interestType: 'PROFESSIONAL_ACCESS_INQUIRY', sourcePage: input.sourcePage, isNewCustomer }),
      html: buildLeadCapturedHtml({
        name: input.contactName,
        email: input.businessEmail,
        phone: input.phone ?? null,
        interestType: 'PROFESSIONAL_ACCESS_INQUIRY',
        productName: null,
        productSize: null,
        message: `Business: ${input.businessName}${input.website ? ` (${input.website})` : ''}. Expected volume: ${input.expectedVolume ?? 'not specified'}. Review at /admin/professional-access.`,
        sourcePage: input.sourcePage,
        isNewCustomer,
      }),
    },
    { actorType: 'SYSTEM' }
  )

  void lead // referenced for clarity that the LeadCapture row is intentionally created, not unused

  return application
}

export interface ListApplicationsParams {
  status?: ProfessionalAccessStatus
  search?: string
}

export async function listProfessionalAccessApplications(params: ListApplicationsParams = {}) {
  return prisma.professionalAccessApplication.findMany({
    where: {
      status: params.status,
      ...(params.search
        ? {
            OR: [
              { businessName: { contains: params.search, mode: 'insensitive' } },
              { contactName: { contains: params.search, mode: 'insensitive' } },
              { businessEmail: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { id: true, firstName: true, lastName: true, email: true, proEligible: true, status: true } } },
  })
}

export async function getProfessionalAccessApplication(id: string) {
  return prisma.professionalAccessApplication.findUnique({
    where: { id },
    include: { customer: true },
  })
}

// The one place Customer.proEligible is ever set as a consequence of the
// application flow (the quick-grant route -- app/api/admin/customers/[id]/
// professional-access/route.ts -- remains the other, for a customer who
// never went through a formal application). Approval always requires a
// linked Customer -- captureLead() above guarantees this for every
// application created through submitProfessionalAccessApplication, so this
// should never actually be null in practice; guarded anyway rather than
// assumed.
export async function reviewProfessionalAccessApplication(
  id: string,
  action: 'approve' | 'reject' | 'request_more_info' | 'revoke',
  adminId: string,
  notes?: string
): Promise<ProfessionalAccessApplication> {
  const application = await prisma.professionalAccessApplication.findUnique({ where: { id }, include: { customer: true } })
  if (!application) throw new ProfessionalAccessApplicationError('Application not found')
  if (!application.customer) throw new ProfessionalAccessApplicationError('This application has no linked customer record to grant or revoke entitlement against')

  const statusByAction: Record<typeof action, ProfessionalAccessStatus> = {
    approve: 'APPROVED',
    reject: 'REJECTED',
    request_more_info: 'MORE_INFO_REQUESTED',
    revoke: 'REVOKED',
  }
  const nextStatus = statusByAction[action]

  // Idempotency guard -- an admin double-click (or two admin tabs) approving
  // the same already-approved application must not grant entitlement twice
  // or send a duplicate approval email.
  if (application.status === nextStatus) return application

  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.professionalAccessApplication.update({
      where: { id },
      data: { status: nextStatus, reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: notes ?? undefined },
    })
    if (action === 'approve') {
      await tx.customer.update({ where: { id: application.customer!.id }, data: { proEligible: true } })
    } else if (action === 'revoke') {
      await tx.customer.update({ where: { id: application.customer!.id }, data: { proEligible: false } })
    }
    return app
  })

  await recordCustomerActivity({
    customerId: application.customer.id,
    eventType:
      action === 'approve'
        ? 'PROFESSIONAL_ACCESS_GRANTED'
        : action === 'revoke'
          ? 'PROFESSIONAL_ACCESS_REVOKED'
          : action === 'reject'
            ? 'PROFESSIONAL_ACCESS_APPLICATION_REJECTED'
            : 'PROFESSIONAL_ACCESS_APPLICATION_MORE_INFO_REQUESTED',
    newValue: notes ?? application.status,
    source: 'MANUAL',
    userId: adminId,
  })

  await prisma.adminAuditLog.create({
    data: {
      action: `PROFESSIONAL_ACCESS_APPLICATION_${nextStatus}`,
      entity: 'ProfessionalAccessApplication',
      entityId: id,
      adminId,
      details: { notes: notes ?? null },
    },
  })

  await sendReviewEmail(updated, action, notes)

  return updated
}

async function sendReviewEmail(application: ProfessionalAccessApplication, action: 'approve' | 'reject' | 'request_more_info' | 'revoke', notes?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    if (action === 'approve') {
      await sendCategorizedEmail(
        {
          category: 'PROFESSIONAL_ACCESS_APPROVED',
          to: application.businessEmail,
          subject: professionalAccessApprovedSubject(),
          html: buildProfessionalAccessApprovedHtml({ contactName: application.contactName, businessName: application.businessName, storefrontUrl: appUrl }),
        },
        { customerId: application.customerId ?? undefined, actorType: 'MANUAL' }
      )
    } else if (action === 'reject') {
      await sendCategorizedEmail(
        {
          category: 'PROFESSIONAL_ACCESS_REJECTED',
          to: application.businessEmail,
          subject: professionalAccessRejectedSubject(),
          html: buildProfessionalAccessRejectedHtml({ contactName: application.contactName, businessName: application.businessName, reviewNotes: notes }),
        },
        { customerId: application.customerId ?? undefined, actorType: 'MANUAL' }
      )
    } else if (action === 'request_more_info') {
      await sendCategorizedEmail(
        {
          category: 'PROFESSIONAL_ACCESS_MORE_INFO_REQUESTED',
          to: application.businessEmail,
          subject: professionalAccessMoreInfoRequestedSubject(),
          html: buildProfessionalAccessMoreInfoRequestedHtml({ contactName: application.contactName, businessName: application.businessName, reviewNotes: notes ?? 'Please reply with more detail about your business/research use.' }),
        },
        { customerId: application.customerId ?? undefined, actorType: 'MANUAL' }
      )
    }
    // 'revoke' via the application record reuses the same customer-facing
    // PROFESSIONAL_ACCESS_REVOKED email the quick-grant route sends --
    // intentionally not duplicated here; see
    // lib/professionalAccess/entitlement.ts's revokeProfessionalAccess if a
    // revoke needs to happen outside the application-review path.
  } catch (err) {
    // Never let a notification failure undo an already-committed review
    // decision -- same discipline as every other post-commit send in this
    // codebase (e.g. app/api/checkout/route.ts's backorder email handling).
    console.error('[professionalAccess] Failed to send review-decision email:', err)
  }
}
