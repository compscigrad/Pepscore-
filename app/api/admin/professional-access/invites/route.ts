// GET  /api/admin/professional-access/invites — list, most recent first
// POST /api/admin/professional-access/invites — { email, customerId? } create/resend
// 2026-08-19 Professional Access sprint, section 12.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateProfessionalAccessInvite, ProfessionalAccessInviteError } from '@/lib/professionalAccess/invites'

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const invites = await prisma.professionalAccessInvite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })
  return NextResponse.json({ invites })
}

const postSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  customerId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const { email, customerId } = postSchema.parse(await req.json())
    const invite = await generateProfessionalAccessInvite({ email, customerId, createdBy: userId! })
    await prisma.adminAuditLog.create({
      data: { action: 'PROFESSIONAL_ACCESS_INVITE_SENT', entity: 'ProfessionalAccessInvite', entityId: invite.id, adminId: userId!, details: { email } },
    })
    return NextResponse.json({ invite })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProfessionalAccessInviteError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/professional-access/invites POST]', err)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 400 })
  }
}
