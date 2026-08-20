// PATCH /api/admin/professional-access/invites/[id] — { action: 'resend' | 'revoke' }
// 2026-08-19 Professional Access sprint, section 12.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { resendProfessionalAccessInvite, revokeProfessionalAccessInvite, ProfessionalAccessInviteError } from '@/lib/professionalAccess/invites'

interface RouteParams {
  params: Promise<{ id: string }>
}

const patchSchema = z.object({ action: z.enum(['resend', 'revoke']) })

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const { action } = patchSchema.parse(await req.json())
    if (action === 'resend') {
      await resendProfessionalAccessInvite(id, userId!)
    } else {
      await revokeProfessionalAccessInvite(id, userId!)
    }
    await prisma.adminAuditLog.create({
      data: { action: action === 'resend' ? 'PROFESSIONAL_ACCESS_INVITE_RESENT' : 'PROFESSIONAL_ACCESS_INVITE_REVOKED', entity: 'ProfessionalAccessInvite', entityId: id, adminId: userId! },
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof ProfessionalAccessInviteError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/professional-access/invites/:id PATCH]', err)
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 400 })
  }
}
