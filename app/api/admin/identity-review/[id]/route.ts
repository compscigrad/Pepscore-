// PATCH /api/admin/identity-review/[id] — { action: 'approve', customerId }
//       resolves a MULTIPLE_MATCHES case by linking the chosen candidate, or
//       { action: 'dismiss', notes? } — closes any case without linking.
// See lib/portal/reviewCases.ts for exactly what each action can and can't do.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { approveIdentityReviewCase, dismissIdentityReviewCase, ReviewCaseError } from '@/lib/portal/reviewCases'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), customerId: z.string().min(1) }),
  z.object({ action: z.literal('dismiss'), notes: z.string().max(500).optional() }),
])

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())

    if (payload.action === 'approve') {
      const resolved = await approveIdentityReviewCase(id, payload.customerId, userId!)
      await prisma.adminAuditLog.create({
        data: {
          action: 'APPROVE_IDENTITY_REVIEW_CASE',
          entity: 'CustomerIdentityReviewCase',
          entityId: id,
          adminId: userId!,
          details: { linkedCustomerId: payload.customerId },
        },
      })
      return NextResponse.json(resolved)
    }

    const dismissed = await dismissIdentityReviewCase(id, userId!, payload.notes)
    await prisma.adminAuditLog.create({
      data: { action: 'DISMISS_IDENTITY_REVIEW_CASE', entity: 'CustomerIdentityReviewCase', entityId: id, adminId: userId! },
    })
    return NextResponse.json(dismissed)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ReviewCaseError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/identity-review/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update review case' }, { status: 400 })
  }
}
