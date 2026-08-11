// Safe customer-merge workflow (Phase 4E). Two Customer rows genuinely
// represent the same person more often than the exact-match auto-merge in
// lib/customers.ts (email/phone) catches -- a typo'd name, a second
// walk-up purchase with a slightly different spelling -- and until now the
// only signal was the "Possible Duplicate" banner on the admin customer
// profile (findPossibleDuplicateCustomers), with no action to resolve it:
// an admin could see two records were probably the same person and had no
// system-provided way to combine them short of a raw database edit.
//
// This never auto-merges -- matching the standing "never auto-merge on a
// weak match" rule findPossibleDuplicateCustomers itself already follows
// -- an admin explicitly picks which record survives and initiates the
// merge. Real identity conflicts (two separately-claimed portal logins,
// two Stripe Customer objects, two first-order-offer claims) are detected
// first and block the merge automatically rather than guessing which of
// two genuinely-different real accounts should win; the desired outcome is
// always either a safe merge or an explicitly-blocked one with an
// actionable reason, never a silent dead end.
import { prisma } from '@/lib/prisma'
import { recomputeAndSaveCustomerStatus } from '@/lib/customers'
import type { Customer, Prisma } from '@prisma/client'

export type MergeConflictReason = 'BOTH_HAVE_LINKED_PORTAL_ACCOUNTS' | 'BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS' | 'BOTH_HAVE_STRIPE_CUSTOMER_IDS'

export interface MergeConflict {
  reason: MergeConflictReason
  message: string
}

const CONFLICT_MESSAGES: Record<MergeConflictReason, string> = {
  BOTH_HAVE_LINKED_PORTAL_ACCOUNTS:
    "Both records are linked to a different real portal login. Merging two separate logins into one isn't safe to automate -- confirm with the customer which login they actually use, then unlink the other one from Portal Access before merging.",
  BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS:
    "Both records have already claimed a first-order offer. Merging would require deciding which claim (and its issued promotion code) is authoritative -- review both codes' redemption status manually before merging, so a still-usable code is never silently orphaned.",
  BOTH_HAVE_STRIPE_CUSTOMER_IDS:
    "Both records have their own Stripe Customer object (saved payment methods). Merging would require reconciling two separate real Stripe records -- resolve which one the customer actually uses before merging.",
}

export interface MergePreview {
  survivor: Customer
  loser: Customer
  conflicts: MergeConflict[]
  canMerge: boolean
}

// Pure -- DB-free, so this is the piece regression tests exercise directly
// rather than needing a real database for every case. Takes only the
// fields that actually decide a conflict, not full Customer rows.
export function detectMergeConflicts(input: {
  survivorUserId: string | null
  loserUserId: string | null
  survivorStripeCustomerId: string | null
  loserStripeCustomerId: string | null
  survivorHasFirstOrderClaim: boolean
  loserHasFirstOrderClaim: boolean
}): MergeConflict[] {
  const conflicts: MergeConflict[] = []
  if (input.survivorUserId && input.loserUserId && input.survivorUserId !== input.loserUserId) {
    conflicts.push({ reason: 'BOTH_HAVE_LINKED_PORTAL_ACCOUNTS', message: CONFLICT_MESSAGES.BOTH_HAVE_LINKED_PORTAL_ACCOUNTS })
  }
  if (input.survivorStripeCustomerId && input.loserStripeCustomerId && input.survivorStripeCustomerId !== input.loserStripeCustomerId) {
    conflicts.push({ reason: 'BOTH_HAVE_STRIPE_CUSTOMER_IDS', message: CONFLICT_MESSAGES.BOTH_HAVE_STRIPE_CUSTOMER_IDS })
  }
  if (input.survivorHasFirstOrderClaim && input.loserHasFirstOrderClaim) {
    conflicts.push({ reason: 'BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS', message: CONFLICT_MESSAGES.BOTH_HAVE_FIRST_ORDER_OFFER_CLAIMS })
  }
  return conflicts
}

// Read-only -- safe to call repeatedly (e.g. to render the confirm dialog)
// without any side effect.
export async function previewCustomerMerge(survivorId: string, loserId: string): Promise<MergePreview> {
  if (survivorId === loserId) throw new Error('Cannot merge a customer into itself')

  const [survivor, loser, survivorClaim, loserClaim] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: survivorId } }),
    prisma.customer.findUniqueOrThrow({ where: { id: loserId } }),
    prisma.firstOrderOfferClaim.findUnique({ where: { customerId: survivorId } }),
    prisma.firstOrderOfferClaim.findUnique({ where: { customerId: loserId } }),
  ])

  const conflicts = detectMergeConflicts({
    survivorUserId: survivor.userId,
    loserUserId: loser.userId,
    survivorStripeCustomerId: survivor.stripeCustomerId,
    loserStripeCustomerId: loser.stripeCustomerId,
    survivorHasFirstOrderClaim: Boolean(survivorClaim),
    loserHasFirstOrderClaim: Boolean(loserClaim),
  })

  return { survivor, loser, conflicts, canMerge: conflicts.length === 0 }
}

export type MergeCustomersResult =
  | { status: 'MERGED'; survivor: Customer }
  | { status: 'BLOCKED'; conflicts: MergeConflict[] }

export async function mergeCustomers(survivorId: string, loserId: string, mergedBy: string): Promise<MergeCustomersResult> {
  const preview = await previewCustomerMerge(survivorId, loserId)
  if (!preview.canMerge) return { status: 'BLOCKED', conflicts: preview.conflicts }

  const { survivor, loser } = preview

  await prisma.$transaction(async (tx) => {
    // Reassign every real reference from loser -> survivor. Historical
    // records (Invoice, Communication, etc.) already snapshot the
    // customer's name/email/phone independently at the time they were
    // created (the same "past invoices keep their own snapshot" precedent
    // documented in docs/Decisions.md) -- reassigning customerId only
    // changes which live Customer record they're reachable FROM, it never
    // rewrites what they say happened.
    await tx.invoice.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.customerAccountCredit.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.savedPaymentMethod.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.leadCapture.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.promotionCode.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.customerPortalInvite.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.customerIdentityReviewCase.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.customerActivityLog.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.customerAccessEvent.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.intakeLink.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.notification.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    await tx.communication.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })
    // 1:1 (customerId is @unique on this model) -- safe to reassign
    // unconditionally since previewCustomerMerge already confirmed at most
    // one of survivor/loser has a claim.
    await tx.firstOrderOfferClaim.updateMany({ where: { customerId: loser.id }, data: { customerId: survivor.id } })

    // Audit trail before the loser row is deleted -- snapshots its identity
    // since every row just reassigned above no longer has any reference
    // back to which OTHER customer it originally belonged to.
    await tx.customerActivityLog.create({
      data: {
        customerId: survivor.id,
        eventType: 'CUSTOMER_MERGED',
        previousValue: `${loser.firstName} ${loser.lastName}${loser.email ? ` <${loser.email}>` : ''} (id ${loser.id})`,
        newValue: `Merged into ${survivor.firstName} ${survivor.lastName} (id ${survivor.id})`,
        source: 'MANUAL',
        userId: mergedBy,
      },
    })
    await tx.adminAuditLog.create({
      data: {
        action: 'MERGE_CUSTOMER',
        entity: 'Customer',
        entityId: survivor.id,
        adminId: mergedBy,
        details: {
          survivorId: survivor.id,
          loserId: loser.id,
          loserSnapshot: { firstName: loser.firstName, lastName: loser.lastName, email: loser.email, phone: loser.phone, company: loser.company },
        } as unknown as Prisma.InputJsonValue,
      },
    })

    // Deleted before transferring userId/stripeCustomerId to the survivor
    // below -- both are @unique, so the loser's row (still holding the
    // original value) must be gone before the survivor can take it,
    // otherwise the survivor's UPDATE would collide with the loser's own
    // still-live unique value in the same transaction.
    await tx.customer.delete({ where: { id: loser.id } })

    // Fill only what the survivor doesn't already have -- the survivor's
    // own data always wins, matching the exact "existing wins, fill only
    // missing fields" precedent already established for the intake
    // auto-merge path (lib/customers.ts, Decision 8).
    const survivorUpdate: Prisma.CustomerUncheckedUpdateInput = {}
    if (!survivor.userId && loser.userId) survivorUpdate.userId = loser.userId
    if (!survivor.stripeCustomerId && loser.stripeCustomerId) survivorUpdate.stripeCustomerId = loser.stripeCustomerId
    if (!survivor.email && loser.email) survivorUpdate.email = loser.email
    if (!survivor.phone && loser.phone) survivorUpdate.phone = loser.phone
    if (!survivor.company && loser.company) survivorUpdate.company = loser.company
    if (!survivor.billingAddress && loser.billingAddress) survivorUpdate.billingAddress = loser.billingAddress as Prisma.InputJsonValue
    if (!survivor.shippingAddress && loser.shippingAddress) survivorUpdate.shippingAddress = loser.shippingAddress as Prisma.InputJsonValue

    if (Object.keys(survivorUpdate).length > 0) {
      await tx.customer.update({ where: { id: survivor.id }, data: survivorUpdate })
    }
  })

  // Outside the transaction, matching every other post-merge recomputation
  // in this codebase (e.g. syncCustomerFromInvoiceEvent) -- the survivor
  // may have just inherited a further-along invoice/intake history than
  // its own status reflected.
  await recomputeAndSaveCustomerStatus(survivor.id)

  const merged = await prisma.customer.findUniqueOrThrow({ where: { id: survivor.id } })
  return { status: 'MERGED', survivor: merged }
}
