// The one place a Clerk identity resolves to a User row — used by every
// portal identity-linking path (admin invite claim, self-service claim/
// registration, admin review-case approval). A plain upsert() is not safe
// here: two genuinely concurrent calls for the same brand-new Clerk user
// (e.g. two browser tabs both loading /account at once) can both pass
// upsert's internal "does this row exist" check before either commits,
// and the loser throws a P2002 unique-constraint violation on `clerkId`
// instead of resolving — a real race surfaced by this project's PR7
// security rehearsal, not a hypothetical. The fix is the standard
// upsert-then-retry-on-conflict pattern: if create loses the race, the
// winner's row now exists, so just re-fetch it.
import { Prisma, type User } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export function isUniqueConstraintViolation(err: unknown, field: string): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes(field)
  )
}

export async function upsertUserByClerkId(clerkUserId: string, email: string): Promise<User> {
  try {
    return await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: {},
      create: { clerkId: clerkUserId, email },
    })
  } catch (err) {
    if (!isUniqueConstraintViolation(err, 'clerkId')) throw err
    // Lost the race — a concurrent call already created this exact row.
    // findUniqueOrThrow is safe: the row is guaranteed to exist now.
    return prisma.user.findUniqueOrThrow({ where: { clerkId: clerkUserId } })
  }
}

// Read-only counterpart to upsertUserByClerkId -- for callers that only
// need to know whether a User row already exists for this Clerk identity
// (e.g. a status check) and must never create one as a side effect of a
// GET request. Returns the internal User.id (a separate cuid, NOT the
// Clerk id) or null if this Clerk identity has never resolved to a User row.
export async function findUserIdByClerkId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  return user?.id ?? null
}
