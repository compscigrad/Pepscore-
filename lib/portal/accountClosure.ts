// Customer-initiated account closure (2026-08-20). CRITICAL business rule:
// this never requires Admin approval -- a customer with a $0 balance closes
// immediately. The one real gate is the outstanding-balance check, reusing
// the exact same canonical balance the portal dashboard already shows the
// customer (lib/portal/dashboard.ts's getPortalDashboardData()), never a
// second, disconnected balance calculation.
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getPortalDashboardData } from './dashboard'
import { recordCustomerActivity } from '@/lib/customers'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { ADMIN_EMAIL } from '@/lib/resend'
import { accountClosedSubject, buildAccountClosedHtml, accountClosureAlertSubject, buildAccountClosureAlertHtml } from '@/emails/AccountClosure'
import type { Customer } from '@prisma/client'

export class AccountClosureBlockedError extends Error {
  constructor(public outstandingBalance: number) {
    super(`Cannot close account with an outstanding balance of $${outstandingBalance.toFixed(2)}.`)
  }
}

export interface CloseAccountResult {
  customer: Customer
}

// Best-effort Clerk session revocation -- functionally redundant with
// portalAccessDisabled (every portal page/API re-checks it on every
// request, so a still-valid Clerk session can't reach any customer data
// past this point regardless), but revoking the token itself is a genuine
// extra layer. A Clerk API failure here must never block the closure
// itself -- same "side effect failures never undo the real operation"
// discipline as every notification send in this codebase.
async function revokeClerkSessions(clerkUserId: string): Promise<void> {
  try {
    const client = await clerkClient()
    const sessions = await client.sessions.getSessionList({ userId: clerkUserId, status: 'active' })
    await Promise.all(sessions.data.map((s) => client.sessions.revokeSession(s.id)))
  } catch (err) {
    console.error('[accountClosure] Failed to revoke Clerk sessions (non-fatal):', err)
  }
}

// The one real gate: outstanding balance blocks ordinary closure. Recorded
// as an activity event either way (blocked attempts are visible to Admin,
// per section AC -- an operational fact, never an alarming notification).
export async function closeCustomerAccount(customerId: string, clerkUserId: string, reason?: string | null): Promise<CloseAccountResult> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new Error('Customer not found')
  if (customer.accountClosedAt) return { customer } // already closed -- idempotent, not an error

  const dashboard = await getPortalDashboardData(customerId)
  if (dashboard.outstandingBalance > 0) {
    await recordCustomerActivity({
      customerId,
      eventType: 'ACCOUNT_CLOSURE_BLOCKED_OUTSTANDING_BALANCE',
      newValue: dashboard.outstandingBalance.toFixed(2),
      source: 'SYSTEM',
    })
    throw new AccountClosureBlockedError(dashboard.outstandingBalance)
  }

  const closedAt = new Date()
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      portalAccessDisabled: true,
      accountClosedAt: closedAt,
      accountClosedReason: reason ?? 'Closed by customer',
    },
  })

  await recordCustomerActivity({
    customerId,
    eventType: 'ACCOUNT_CLOSED_BY_CUSTOMER',
    newValue: reason ?? undefined,
    source: 'SYSTEM',
  })

  await revokeClerkSessions(clerkUserId)

  // Customer confirmation -- best-effort, never blocks/undoes the closure
  // that already committed.
  if (customer.email) {
    await sendCategorizedEmail(
      { category: 'ACCOUNT_CLOSED', to: customer.email, subject: accountClosedSubject(), html: buildAccountClosedHtml({ firstName: customer.firstName }) },
      { customerId, actorType: 'SYSTEM' }
    )
  }

  // Admin alert -- informational/operational, NOT an approval request; the
  // account is already closed by the time this sends.
  const [openInvoiceCount, activeAuthorizationCount] = await Promise.all([
    prisma.invoice.count({ where: { customerId, deletedAt: null, status: { in: ['DRAFT', 'ISSUED'] } } }),
    prisma.priceMatchAuthorization.count({ where: { customerId, status: 'ACTIVE' } }),
  ])
  await sendCategorizedEmail(
    {
      category: 'ACCOUNT_CLOSURE_ALERT',
      to: ADMIN_EMAIL,
      subject: accountClosureAlertSubject({ customerName: `${customer.firstName} ${customer.lastName}`.trim() }),
      html: buildAccountClosureAlertHtml({
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        customerId,
        email: customer.email,
        closedAt,
        openInvoiceCount,
        activeAuthorizationCount,
        proEligible: customer.proEligible,
        customerProfileUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/admin/customers/${customerId}`,
      }),
    },
    { customerId, actorType: 'SYSTEM' }
  )

  return { customer: updated }
}

// Admin-only, post-closure housekeeping -- never reactivates access, never
// deletes anything. Purely a "reduce clutter in active views" marker.
export async function archiveClosedCustomer(customerId: string, adminId: string): Promise<Customer> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) throw new Error('Customer not found')
  if (!customer.accountClosedAt) throw new Error('Only a closed account can be archived')

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { accountArchivedAt: new Date(), accountArchivedBy: adminId },
  })

  await recordCustomerActivity({ customerId, eventType: 'ACCOUNT_ARCHIVED', source: 'MANUAL', userId: adminId })

  return updated
}
