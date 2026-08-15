// Centralized server-side authorization (2026-08-15 RBAC migration).
// Replaces the 67 duplicated `function isAdmin(userId) { return userId ===
// process.env.ADMIN_CLERK_USER_ID }` inline checks that used to live one per
// admin API route -- every one of those routes now calls requireAdmin()
// here instead, so there is exactly one place this logic can drift or be
// gotten wrong.
//
// Role now comes from the database (User.role), not solely the env var.
// ADMIN_CLERK_USER_ID is kept ONLY as a one-time bootstrap path: the first
// authorized request from that exact Clerk identity promotes (or creates)
// its User row to ADMIN, after which every future check for that identity
// reads the database like any other admin -- this branch becomes dead code
// for them from then on. It never grants ADMIN to any other Clerk identity.
// Retire the env var read entirely once every environment that needs it
// (local/preview/production) has been confirmed to have a real ADMIN User
// row -- see the RBAC migration report for the exact verification done.
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { Role } from '@prisma/client'

async function resolveRole(clerkUserId: string): Promise<Role | null> {
  const existing = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { role: true } })
  if (existing) return existing.role

  // Bootstrap fallback -- see file header. Only ever fires for the legacy
  // admin identity, and only while it has no User row yet.
  if (clerkUserId === process.env.ADMIN_CLERK_USER_ID) {
    const clerkUser = await currentUser()
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? clerkUser?.emailAddresses[0]?.emailAddress
    // Can't create a User row without an email (schema requires one) -- an
    // extremely unlikely Clerk state, but fail closed rather than throw.
    if (!email) return null
    const row = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: { role: 'ADMIN' },
      create: { clerkId: clerkUserId, email, role: 'ADMIN' },
    })
    return row.role
  }

  return null
}

// Returns the Clerk userId if the current request is from an authorized
// admin, or null otherwise. Every admin API route calls this once at the
// top of each handler and returns 403 immediately when it's null -- the
// same shape the old isAdmin(userId) check had, so route bodies barely
// change:
//   const userId = await requireAdmin()
//   if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
export async function requireAdmin(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const role = await resolveRole(userId)
  return role === 'ADMIN' ? userId : null
}

// Non-throwing boolean form for surfaces that need to know admin status
// without gating the response on it -- e.g. GET /api/admin/whoami, which
// exists specifically to answer this for the client-side nav without
// itself requiring admin.
export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await requireAdmin()) !== null
}

// ANONYMOUS / CLIENT are intentionally not separate exported helpers here:
// "no admin role" already reads as CLIENT for an authenticated Clerk user
// and ANONYMOUS for an unauthenticated one everywhere else in the app
// (customer portal access is its own already-real gate --
// lib/portalAuth.ts / Customer.userId -- unrelated to admin authorization).
// Narrower admin privileges (e.g. "can issue refunds" vs "can edit
// products") should be added later as a separate AdminPermission-style
// model keyed off the User row, not as more Role enum values.
