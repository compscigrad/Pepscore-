// Price Match Guarantee / Customer Preferred Pricing -- submission +
// admin review queue logic (2026-08-20 sprint). Extends the existing
// lead-capture architecture exactly like lib/professionalAccess/
// applications.ts does: every request also creates a real LeadCapture row
// (interestType PRICE_MATCH_REQUEST -- the same value the pre-existing
// Footer "Request a Price Match" link already used, now driving a real
// structured record instead of a bare message field) so it stays visible
// in the existing admin CRM/Leads views, while PriceMatchRequest below
// carries the actual review-queue state that LeadCapture was never
// designed to hold.
//
// The database row IS the system of record -- every email in this module
// is a courtesy alert/acknowledgment, never load-bearing. A send failure
// (see sendCategorizedEmail's own never-throws contract) can never undo or
// block a request/authorization that already committed to the database.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { captureLead } from '@/lib/leads/service'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { trackServerEvent } from '@/lib/analytics/serverTrack'
import { AnalyticsEvent } from '@/lib/analytics/events'
import { ADMIN_EMAIL } from '@/lib/resend'
import { generatePriceMatchRequestNumber } from './proofUpload'
import {
  priceMatchRequestReceivedSubject,
  buildPriceMatchRequestReceivedHtml,
  priceMatchMoreInfoRequestedSubject,
  buildPriceMatchMoreInfoRequestedHtml,
  priceMatchApprovedOneTimeSubject,
  buildPriceMatchApprovedOneTimeHtml,
  priceMatchApprovedPersistentSubject,
  buildPriceMatchApprovedPersistentHtml,
  priceMatchRejectedSubject,
  buildPriceMatchRejectedHtml,
  priceMatchRevokedSubject,
  buildPriceMatchRevokedHtml,
  priceMatchRequestAlertSubject,
  buildPriceMatchRequestAlertHtml,
} from '@/emails/PriceMatch'
import type {
  PriceMatchRequest,
  PriceMatchRequestStatus,
  PriceMatchRejectionReason,
  PriceMatchAuthorization,
  PriceMatchAuthorizationType,
  InvoiceItemSellUnit,
  Product,
} from '@prisma/client'

export class PriceMatchError extends Error {}

// Current active price for the exact sell unit requested -- surfaced in the
// admin alert email so a reviewer doesn't have to go look it up before
// deciding whether a match is even needed. Deliberately reads the raw
// active*Price columns directly rather than going through
// lib/storefront/pricing.ts's getStorefrontPrice() (public-visitor-facing,
// standard-case-only) since this needs whichever tier was actually
// requested, including Professional.
function currentActivePriceFor(product: Pick<Product, 'activeStandardCasePrice' | 'activeProCasePrice' | 'activeBulkPrice' | 'activeIndividualVialPrice'>, sellUnit: InvoiceItemSellUnit): number | null {
  switch (sellUnit) {
    case 'CASE_STANDARD':
      return product.activeStandardCasePrice
    case 'CASE_PRO':
      return product.activeProCasePrice
    case 'CASE_BULK':
      return product.activeBulkPrice
    case 'INDIVIDUAL_VIAL':
      return product.activeIndividualVialPrice
  }
}

export interface SubmitPriceMatchRequestProofFile {
  fileName: string
  mimeType: string
  buffer: Buffer
}

export interface SubmitPriceMatchRequestInput {
  contactName: string
  contactEmail: string
  contactPhone?: string | null
  productId: string
  sellUnit: InvoiceItemSellUnit
  competitorName: string
  competitorUrl?: string | null
  competitorPrice: number
  competitorShippingCost?: number | null
  competitorDeliveredPrice: number
  proofUrl?: string | null
  proofNote?: string | null
  // Already validated (lib/priceMatch/proofUpload.ts's validateProofFile())
  // by the API route before this is ever called -- this function trusts the
  // buffer it's given. Competitor URL and an uploaded file are never
  // mutually exclusive; a submission may include either, both, or neither.
  proofFile?: SubmitPriceMatchRequestProofFile | null
  customerNote?: string | null
  sourcePage: string
  referrer?: string | null
  landingUrl?: string | null
  consent: boolean
  ipAddress?: string | null
}

// Rate-limited at the API route layer (same convention as every other
// public intake endpoint). One request per submission -- a repeat request
// from the same email/phone links to the same Customer (via captureLead's
// upsertCustomerFromIntake) but always creates a NEW PriceMatchRequest row,
// never silently overwrites a prior one, so a customer's request history
// stays intact.
export async function submitPriceMatchRequest(input: SubmitPriceMatchRequestInput): Promise<PriceMatchRequest> {
  const product = await prisma.product.findUnique({ where: { id: input.productId } })
  if (!product) throw new PriceMatchError('Product not found')

  const { customer, isNewCustomer } = await captureLead({
    name: input.contactName,
    email: input.contactEmail,
    phone: input.contactPhone,
    interestType: 'PRICE_MATCH_REQUEST',
    productSlug: product.slug,
    productName: product.name,
    productSize: product.size,
    message: input.customerNote,
    sourcePage: input.sourcePage,
    referrer: input.referrer,
    landingUrl: input.landingUrl,
    consent: input.consent,
  })

  // DB-first, always -- the request row is fully committed (including
  // whatever proof metadata is known) before any email is even attempted.
  // A unique-constraint retry loop, not a single attempt: requestNumber's
  // random suffix makes a collision astronomically unlikely, but this is
  // cheap insurance rather than a hard assumption.
  let request: PriceMatchRequest | null = null
  for (let attempt = 0; attempt < 5 && !request; attempt++) {
    try {
      request = await prisma.priceMatchRequest.create({
        data: {
          requestNumber: generatePriceMatchRequestNumber(),
          customerId: customer.id,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? undefined,
          productId: input.productId,
          sellUnit: input.sellUnit,
          competitorName: input.competitorName,
          competitorUrl: input.competitorUrl ?? undefined,
          competitorPrice: input.competitorPrice,
          competitorShippingCost: input.competitorShippingCost ?? undefined,
          competitorDeliveredPrice: input.competitorDeliveredPrice,
          proofUrl: input.proofUrl ?? undefined,
          proofNote: input.proofNote ?? undefined,
          customerNote: input.customerNote ?? undefined,
          ipAddress: input.ipAddress ?? undefined,
          proofProvided: !!input.proofFile,
          proofFileName: input.proofFile?.fileName ?? undefined,
          proofMimeType: input.proofFile?.mimeType ?? undefined,
          proofFileSize: input.proofFile?.buffer.length ?? undefined,
        },
      })
    } catch (err) {
      const isUniqueConflict = err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002'
      if (!isUniqueConflict || attempt === 4) throw err
    }
  }
  if (!request) throw new PriceMatchError('Could not create a price match request after multiple attempts')

  await recordCustomerActivity({
    customerId: customer.id,
    eventType: 'PRICE_MATCH_REQUEST_SUBMITTED',
    newValue: request.id,
    source: 'SYSTEM',
  })

  await trackServerEvent(AnalyticsEvent.PRICE_MATCH_REQUEST_SUBMITTED, {
    productSlug: product.slug,
    sellUnit: input.sellUnit,
    competitorDeliveredPrice: input.competitorDeliveredPrice,
  })

  // Applicant acknowledgment -- best-effort, never blocks the submission.
  await sendCategorizedEmail(
    {
      category: 'PRICE_MATCH_REQUEST_RECEIVED',
      to: input.contactEmail,
      subject: priceMatchRequestReceivedSubject(),
      html: buildPriceMatchRequestReceivedHtml({ contactName: input.contactName, productName: product.name, productSize: product.size }),
    },
    { customerId: customer.id, actorType: 'SYSTEM' }
  )

  // Admin alert -- immediate, always to admin@pepscorelab.com (owner-locked
  // decision: no separate pricematch@ alias). Includes our own current
  // price for the exact sell unit requested so the reviewer doesn't have to
  // go look it up before deciding whether a match is even needed, the
  // customer-safe requestNumber, and a deep link straight to this record.
  // If a proof file was submitted, it's attached directly to THIS email --
  // Google Workspace becomes its durable copy; Pepscore never writes the
  // bytes anywhere. The request row above already committed regardless of
  // what happens next (DB-first-then-email rule) -- a send/attachment
  // failure here only ever updates proofDeliveryStatus, never rolls back
  // or deletes the request.
  const currentPrice = currentActivePriceFor(product, input.sellUnit)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const reviewUrl = `${appUrl}/admin/price-match/${request.id}`
  const alertProps = {
    requestNumber: request.requestNumber,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    productName: product.name,
    productSize: product.size,
    competitorName: input.competitorName,
    competitorDeliveredPrice: input.competitorDeliveredPrice,
    currentPrice,
    isNewCustomer,
    submittedAt: request.createdAt,
    hasProofAttachment: !!input.proofFile,
    reviewUrl,
  }

  const alertResult = await sendCategorizedEmail(
    {
      category: 'PRICE_MATCH_REQUEST_ALERT',
      to: ADMIN_EMAIL,
      subject: priceMatchRequestAlertSubject(alertProps),
      html: buildPriceMatchRequestAlertHtml(alertProps),
      attachments: input.proofFile ? [{ filename: input.proofFile.fileName, content: input.proofFile.buffer }] : undefined,
    },
    { actorType: 'SYSTEM' }
  )

  // Only meaningful when a proof file was actually submitted -- a request
  // with no proof stays proofDeliveryStatus: NONE regardless of whether
  // the (attachment-free) admin alert itself sent successfully.
  if (input.proofFile) {
    request = await prisma.priceMatchRequest.update({
      where: { id: request.id },
      data: {
        proofDeliveryStatus: alertResult.sent ? 'SENT' : 'FAILED',
        proofEmailMessageId: alertResult.providerMessageId ?? undefined,
      },
    })
  }

  return request
}

export interface ListPriceMatchRequestsParams {
  status?: PriceMatchRequestStatus
  search?: string
}

export async function listPriceMatchRequests(params: ListPriceMatchRequestsParams = {}) {
  return prisma.priceMatchRequest.findMany({
    where: {
      status: params.status,
      ...(params.search
        ? {
            OR: [
              { contactName: { contains: params.search, mode: 'insensitive' } },
              { contactEmail: { contains: params.search, mode: 'insensitive' } },
              { competitorName: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
      product: { select: { id: true, name: true, size: true, slug: true } },
      authorization: { select: { id: true, code: true, status: true, authorizationType: true } },
    },
  })
}

export async function getPriceMatchRequest(id: string) {
  return prisma.priceMatchRequest.findUnique({
    where: { id },
    include: {
      customer: true,
      product: true,
      authorization: true,
    },
  })
}

export interface CustomerPreferredPricingRow {
  id: string
  productName: string
  productSize: string
  sellUnit: InvoiceItemSellUnit
  authorizedPrice: number
  authorizationType: PriceMatchAuthorizationType
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'REVOKED'
  expiresAt: Date | null
}

// Customer-portal-safe view of a customer's OWN preferred pricing -- never
// competitor proof, admin review notes, or any other customer's data (see
// PriceMatchAuthorization's own privacy note). Includes REDEEMED (a
// ONE_PURCHASE grant that was already used) alongside ACTIVE so the portal
// can show accurate history, not just currently-usable grants; EXPIRED/
// REVOKED are excluded entirely -- a customer never needs to see a grant
// that no longer applies to them at all.
export async function listCustomerPreferredPricing(customerId: string): Promise<CustomerPreferredPricingRow[]> {
  const rows = await prisma.priceMatchAuthorization.findMany({
    where: { customerId, status: { in: ['ACTIVE', 'REDEEMED'] } },
    include: { product: { select: { name: true, size: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((row) => ({
    id: row.id,
    productName: row.product.name,
    productSize: row.product.size,
    sellUnit: row.sellUnit,
    authorizedPrice: row.authorizedPrice,
    authorizationType: row.authorizationType,
    status: row.status,
    expiresAt: row.expiresAt,
  }))
}

export interface CustomerPriceMatchRequestRow {
  id: string
  requestNumber: string
  productName: string
  productSize: string
  sellUnit: InvoiceItemSellUnit
  status: PriceMatchRequestStatus
  createdAt: Date
  moreInfoRequestNote: string | null
}

// Customer-portal-safe view of a customer's OWN price match requests --
// requestNumber/product/variant/submitted date/status only. Deliberately
// never includes competitorName/competitorUrl/proofUrl/proofNote/
// reviewNotes/rejectionReason/ipAddress -- those are Admin-only (competitor
// evidence, internal review reasoning, security metadata), per the same
// privacy boundary listCustomerPreferredPricing() already draws.
// moreInfoRequestNote is the one exception: it's written specifically to be
// read back by the customer (the "what we need from you" text), so it's
// customer-safe by design, unlike reviewNotes.
export async function listCustomerPriceMatchRequests(customerId: string): Promise<CustomerPriceMatchRequestRow[]> {
  const rows = await prisma.priceMatchRequest.findMany({
    where: { customerId },
    include: { product: { select: { name: true, size: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    productName: row.product.name,
    productSize: row.product.size,
    sellUnit: row.sellUnit,
    status: row.status,
    createdAt: row.createdAt,
    moreInfoRequestNote: row.status === 'MORE_INFO_REQUESTED' ? row.moreInfoRequestNote : null,
  }))
}

// Count of PENDING + MORE_INFO_REQUESTED requests -- powers the admin
// NotificationBell/Dashboard indicator (open items needing attention),
// deliberately excluding MORE_INFO_REQUESTED from "urgent" framing at the
// call site's discretion, but still counted here as "not yet closed."
export async function countOpenPriceMatchRequests(): Promise<number> {
  return prisma.priceMatchRequest.count({ where: { status: { in: ['PENDING', 'MORE_INFO_REQUESTED'] } } })
}

// Admin manual override for when proof was supplied through some other
// legitimate channel -- an email reply to the acknowledgment, a follow-up
// message -- after the original attachment attempt was FAILED (or no file
// was ever submitted in the first place). Purely a record-keeping action;
// it never re-triggers an email send or re-validates a file, since there is
// no file for it to act on.
export async function markPriceMatchProofReceivedExternally(id: string, adminId: string): Promise<PriceMatchRequest> {
  const request = await prisma.priceMatchRequest.findUnique({ where: { id } })
  if (!request) throw new PriceMatchError('Request not found')

  const updated = await prisma.priceMatchRequest.update({
    where: { id },
    data: { proofDeliveryStatus: 'RECEIVED_EXTERNALLY', proofMarkedReceivedBy: adminId, proofMarkedReceivedAt: new Date() },
  })

  await prisma.adminAuditLog.create({
    data: { action: 'PRICE_MATCH_PROOF_MARKED_RECEIVED_EXTERNALLY', entity: 'PriceMatchRequest', entityId: id, adminId },
  })

  return updated
}

function generateAuthorizationCode(): string {
  // 6 chars from an unambiguous alphabet (no 0/O/1/I/L) -- human-readable,
  // non-sequential, non-predictable (crypto.randomBytes), same trust
  // boundary as CustomerPortalInvite.token, formatted for a person to
  // actually read back over the phone if needed.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(6)
  let code = ''
  for (const b of bytes) code += alphabet[b % alphabet.length]
  return `PM-${code}`
}

export interface ApprovePriceMatchRequestInput {
  authorizedPrice: number
  authorizationType: PriceMatchAuthorizationType
  expiresAt?: Date | null
  reviewNotes?: string | null
}

// Approval creates exactly one PriceMatchAuthorization per request
// (sourceRequestId is @unique -- a request can never produce two grants).
// Duplicate/conflict handling: any other still-ACTIVE authorization for the
// same customer + product + sellUnit is superseded (revoked) first, so a
// customer can never hold two simultaneously-active negotiated prices on
// the identical line -- the canonical pricing engine's lookup
// (lib/pricing/preferredPricing.ts) assumes at most one.
export async function approvePriceMatchRequest(id: string, adminId: string, input: ApprovePriceMatchRequestInput): Promise<PriceMatchAuthorization> {
  const request = await prisma.priceMatchRequest.findUnique({ where: { id }, include: { customer: true, product: true, authorization: true } })
  if (!request) throw new PriceMatchError('Request not found')
  if (!request.customerId) throw new PriceMatchError('This request has no linked customer record to authorize against')
  if (request.authorization) throw new PriceMatchError('This request has already been approved')
  if (input.authorizedPrice <= 0) throw new PriceMatchError('Authorized price must be a positive amount')
  if (input.authorizationType === 'UNTIL_DATE' && !input.expiresAt) throw new PriceMatchError('An expiration date is required for a time-limited authorization')

  const authorization = await prisma.$transaction(async (tx) => {
    // Supersede any prior still-active grant on the exact same line before
    // creating the new one.
    await tx.priceMatchAuthorization.updateMany({
      where: { customerId: request.customerId!, productId: request.productId, sellUnit: request.sellUnit, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedBy: adminId, revokedAt: new Date(), revokeReason: 'Superseded by a new approved price match' },
    })

    await tx.priceMatchRequest.update({
      where: { id },
      data: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: input.reviewNotes ?? undefined },
    })

    return tx.priceMatchAuthorization.create({
      data: {
        code: generateAuthorizationCode(),
        sourceRequestId: id,
        customerId: request.customerId!,
        productId: request.productId,
        sellUnit: request.sellUnit,
        authorizedPrice: input.authorizedPrice,
        authorizationType: input.authorizationType,
        expiresAt: input.authorizationType === 'UNTIL_DATE' ? input.expiresAt : null,
        createdBy: adminId,
      },
    })
  })

  await recordCustomerActivity({
    customerId: request.customerId,
    eventType: 'PRICE_MATCH_APPROVED',
    newValue: `${authorization.code} @ $${authorization.authorizedPrice}`,
    source: 'MANUAL',
    userId: adminId,
  })

  await prisma.adminAuditLog.create({
    data: {
      action: 'PRICE_MATCH_REQUEST_APPROVED',
      entity: 'PriceMatchRequest',
      entityId: id,
      adminId,
      details: { authorizationId: authorization.id, authorizedPrice: input.authorizedPrice, authorizationType: input.authorizationType },
    },
  })

  await trackServerEvent(AnalyticsEvent.PRICE_MATCH_REQUEST_APPROVED, { authorizationType: input.authorizationType })
  await trackServerEvent(AnalyticsEvent.PREFERRED_PRICE_AUTHORIZATION_CREATED, { authorizationType: input.authorizationType })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    if (input.authorizationType === 'ONE_PURCHASE') {
      await sendCategorizedEmail(
        {
          category: 'PRICE_MATCH_APPROVED_ONE_TIME',
          to: request.contactEmail,
          subject: priceMatchApprovedOneTimeSubject(),
          html: buildPriceMatchApprovedOneTimeHtml({
            contactName: request.contactName,
            productName: request.product.name,
            productSize: request.product.size,
            authorizedPrice: input.authorizedPrice,
            storefrontUrl: `${appUrl}/products/${request.product.slug}`,
          }),
        },
        { customerId: request.customerId, actorType: 'MANUAL' }
      )
    } else {
      await sendCategorizedEmail(
        {
          category: 'PRICE_MATCH_APPROVED_PERSISTENT',
          to: request.contactEmail,
          subject: priceMatchApprovedPersistentSubject(),
          html: buildPriceMatchApprovedPersistentHtml({
            contactName: request.contactName,
            productName: request.product.name,
            productSize: request.product.size,
            authorizedPrice: input.authorizedPrice,
            storefrontUrl: `${appUrl}/products/${request.product.slug}`,
            expiresAt: authorization.expiresAt,
          }),
        },
        { customerId: request.customerId, actorType: 'MANUAL' }
      )
    }
  } catch (err) {
    console.error('[priceMatch] Failed to send approval email:', err)
  }

  return authorization
}

export async function rejectPriceMatchRequest(id: string, adminId: string, rejectionReason: PriceMatchRejectionReason, reviewNotes?: string | null): Promise<PriceMatchRequest> {
  const request = await prisma.priceMatchRequest.findUnique({ where: { id } })
  if (!request) throw new PriceMatchError('Request not found')
  if (request.status === 'REJECTED') return request

  const updated = await prisma.priceMatchRequest.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason, reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: reviewNotes ?? undefined },
  })

  if (request.customerId) {
    await recordCustomerActivity({ customerId: request.customerId, eventType: 'PRICE_MATCH_REJECTED', newValue: rejectionReason, source: 'MANUAL', userId: adminId })
  }
  await prisma.adminAuditLog.create({
    data: { action: 'PRICE_MATCH_REQUEST_REJECTED', entity: 'PriceMatchRequest', entityId: id, adminId, details: { rejectionReason, reviewNotes: reviewNotes ?? null } },
  })
  await trackServerEvent(AnalyticsEvent.PRICE_MATCH_REQUEST_REJECTED, { rejectionReason })

  const product = await prisma.product.findUnique({ where: { id: request.productId }, select: { name: true } })
  try {
    await sendCategorizedEmail(
      {
        category: 'PRICE_MATCH_REJECTED',
        to: request.contactEmail,
        subject: priceMatchRejectedSubject(),
        html: buildPriceMatchRejectedHtml({ contactName: request.contactName, productName: product?.name ?? 'this product', reviewNotes }),
      },
      { customerId: request.customerId ?? undefined, actorType: 'MANUAL' }
    )
  } catch (err) {
    console.error('[priceMatch] Failed to send rejection email:', err)
  }

  return updated
}

export async function requestMoreInfoForPriceMatchRequest(id: string, adminId: string, note: string): Promise<PriceMatchRequest> {
  const request = await prisma.priceMatchRequest.findUnique({ where: { id } })
  if (!request) throw new PriceMatchError('Request not found')

  const updated = await prisma.priceMatchRequest.update({
    where: { id },
    data: { status: 'MORE_INFO_REQUESTED', moreInfoRequestedAt: new Date(), moreInfoRequestNote: note, reviewedBy: adminId },
  })

  if (request.customerId) {
    await recordCustomerActivity({ customerId: request.customerId, eventType: 'PRICE_MATCH_MORE_INFO_REQUESTED', newValue: note, source: 'MANUAL', userId: adminId })
  }
  await trackServerEvent(AnalyticsEvent.PRICE_MATCH_REQUEST_MORE_INFO_REQUESTED)

  const product = await prisma.product.findUnique({ where: { id: request.productId }, select: { name: true } })
  try {
    await sendCategorizedEmail(
      {
        category: 'PRICE_MATCH_MORE_INFO_REQUESTED',
        to: request.contactEmail,
        subject: priceMatchMoreInfoRequestedSubject(),
        html: buildPriceMatchMoreInfoRequestedHtml({ contactName: request.contactName, productName: product?.name ?? 'this product', reviewNotes: note }),
      },
      { customerId: request.customerId ?? undefined, actorType: 'MANUAL' }
    )
  } catch (err) {
    console.error('[priceMatch] Failed to send more-info email:', err)
  }

  return updated
}

// Revoke can target an authorization directly (customer profile "Revoke"
// action), not just via a request review -- an UNTIL_REVOKED grant has no
// other way to end.
export async function revokePriceMatchAuthorization(authorizationId: string, adminId: string, reason?: string | null): Promise<PriceMatchAuthorization> {
  const authorization = await prisma.priceMatchAuthorization.findUnique({ where: { id: authorizationId }, include: { customer: true, product: true } })
  if (!authorization) throw new PriceMatchError('Authorization not found')
  if (authorization.status === 'REVOKED') return authorization

  const updated = await prisma.priceMatchAuthorization.update({
    where: { id: authorizationId },
    data: { status: 'REVOKED', revokedBy: adminId, revokedAt: new Date(), revokeReason: reason ?? undefined },
  })

  await recordCustomerActivity({ customerId: authorization.customerId, eventType: 'PRICE_MATCH_AUTHORIZATION_REVOKED', newValue: authorization.code, source: 'MANUAL', userId: adminId })
  await prisma.adminAuditLog.create({
    data: { action: 'PRICE_MATCH_AUTHORIZATION_REVOKED', entity: 'PriceMatchAuthorization', entityId: authorizationId, adminId, details: { reason: reason ?? null } },
  })
  await trackServerEvent(AnalyticsEvent.PREFERRED_PRICE_AUTHORIZATION_REVOKED)

  try {
    await sendCategorizedEmail(
      {
        category: 'PRICE_MATCH_REVOKED',
        to: authorization.customer.email ?? '',
        subject: priceMatchRevokedSubject(),
        html: buildPriceMatchRevokedHtml({ contactName: authorization.customer.firstName || 'there', productName: authorization.product.name }),
      },
      { customerId: authorization.customerId, actorType: 'MANUAL' }
    )
  } catch (err) {
    console.error('[priceMatch] Failed to send revocation email:', err)
  }

  return updated
}

// Called by the redemption path (checkout / admin invoice line save) the
// moment an authorization is actually applied to a real line -- never at
// approval time. ONE_PURCHASE flips straight to REDEEMED (single-use,
// consistent with its name); UNTIL_DATE/UNTIL_REVOKED stay ACTIVE and can
// redeem repeatedly, only overwriting redeemedAt/redeemedInvoiceId to the
// most recent use.
export async function markPriceMatchAuthorizationRedeemed(authorizationId: string, invoiceId: string): Promise<void> {
  const authorization = await prisma.priceMatchAuthorization.findUnique({ where: { id: authorizationId } })
  if (!authorization || authorization.status !== 'ACTIVE') return

  await prisma.priceMatchAuthorization.update({
    where: { id: authorizationId },
    data: {
      redeemedAt: new Date(),
      redeemedInvoiceId: invoiceId,
      status: authorization.authorizationType === 'ONE_PURCHASE' ? 'REDEEMED' : 'ACTIVE',
    },
  })

  await trackServerEvent(AnalyticsEvent.PREFERRED_PRICE_APPLIED, { authorizationType: authorization.authorizationType })
}
