// GET /api/admin/customers/[id]/access-history — Auth Sprint P3. Combines
// the audit trail (CustomerAccessEvent, historical/append-only) with a
// best-effort live Clerk lookup (current-state flags that aren't
// meaningfully "events": email verification, MFA, banned/locked) for the
// linked Clerk user, if any. Never exposes device details beyond what's
// already on the audit rows themselves — no raw IP is added here that
// wasn't already stored there.
import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getCustomerAccessSummary } from '@/lib/admin/accessHistory'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface LiveClerkState {
  emailVerified: boolean | null
  mfaEnabled: boolean
  banned: boolean
  locked: boolean
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id }, include: { user: true } })

  const summary = await getCustomerAccessSummary(id)

  let live: LiveClerkState | null = null
  if (customer.user?.clerkId) {
    try {
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(customer.user.clerkId)
      const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      live = {
        emailVerified: primaryEmail ? primaryEmail.verification?.status === 'verified' : null,
        mfaEnabled: clerkUser.twoFactorEnabled || clerkUser.totpEnabled || clerkUser.backupCodeEnabled,
        banned: clerkUser.banned,
        locked: clerkUser.locked,
      }
    } catch (err) {
      // Best-effort — the linked Clerk user may have been deleted, or the
      // lookup can transiently fail. The audit-trail summary above is still
      // fully valid and returned regardless.
      console.error('[admin/customers/:id/access-history] Live Clerk lookup failed:', err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ summary, live })
}
