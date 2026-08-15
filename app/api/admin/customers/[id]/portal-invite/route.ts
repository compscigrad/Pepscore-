// GET    /api/admin/customers/[id]/portal-invite — current invite status
//        (active invite if any, or whether this customer is already linked)
// POST   /api/admin/customers/[id]/portal-invite — invite this customer to
//        claim portal access (or return the existing active invite)
// PATCH  /api/admin/customers/[id]/portal-invite — { action: 'resend' |
//        'revoke' | 'disable' | 'enable' | 'unlink' }, the admin repair
//        controls named in the Customer Portal spec's Phase 10
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generatePortalInvite, resendPortalInvite, revokePortalInvite, findActivePortalInviteFor, PortalInviteError } from '@/lib/portalInvites'
import { recordCustomerActivity } from '@/lib/customers'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id } })
  const activeInvite = await findActivePortalInviteFor(id)

  return NextResponse.json({
    linked: Boolean(customer.userId),
    portalAccessDisabled: customer.portalAccessDisabled,
    activeInvite,
  })
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  try {
    const invite = await generatePortalInvite({ customerId: id, createdBy: userId! })

    await prisma.adminAuditLog.create({
      data: { action: 'GENERATE_PORTAL_INVITE', entity: 'Customer', entityId: id, adminId: userId!, details: { inviteId: invite.id } },
    })

    return NextResponse.json(invite, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof PortalInviteError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/customers/:id/portal-invite POST]', err)
    return NextResponse.json({ error: 'Failed to generate invite' }, { status: 400 })
  }
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resend') }),
  z.object({ action: z.literal('revoke') }),
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('enable') }),
  z.object({ action: z.literal('unlink') }),
])

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const payload = patchSchema.parse(await req.json())

    switch (payload.action) {
      case 'resend': {
        const invite = await resendPortalInvite(id, userId!)
        await prisma.adminAuditLog.create({
          data: { action: 'RESEND_PORTAL_INVITE', entity: 'Customer', entityId: id, adminId: userId!, details: { inviteId: invite.id } },
        })
        return NextResponse.json(invite)
      }
      case 'revoke': {
        const invite = await findActivePortalInviteFor(id)
        if (!invite) return NextResponse.json({ error: 'No active invite to revoke' }, { status: 400 })
        await revokePortalInvite(invite.id, userId!)
        await prisma.adminAuditLog.create({
          data: { action: 'REVOKE_PORTAL_INVITE', entity: 'Customer', entityId: id, adminId: userId! },
        })
        return NextResponse.json({ ok: true })
      }
      case 'disable': {
        await prisma.customer.update({ where: { id }, data: { portalAccessDisabled: true } })
        await recordCustomerActivity({ customerId: id, eventType: 'PORTAL_ACCESS_DISABLED', source: 'MANUAL', userId: userId! })
        await prisma.adminAuditLog.create({
          data: { action: 'DISABLE_PORTAL_ACCESS', entity: 'Customer', entityId: id, adminId: userId! },
        })
        return NextResponse.json({ ok: true })
      }
      case 'enable': {
        await prisma.customer.update({ where: { id }, data: { portalAccessDisabled: false } })
        await recordCustomerActivity({ customerId: id, eventType: 'PORTAL_ACCESS_ENABLED', source: 'MANUAL', userId: userId! })
        await prisma.adminAuditLog.create({
          data: { action: 'ENABLE_PORTAL_ACCESS', entity: 'Customer', entityId: id, adminId: userId! },
        })
        return NextResponse.json({ ok: true })
      }
      case 'unlink': {
        // Repair action, not a data-loss one: only the identity link is
        // cleared. Invoices, history, and the invite record all stay intact
        // — the customer can be re-invited to claim again afterward.
        await prisma.customer.update({ where: { id }, data: { userId: null } })
        await recordCustomerActivity({ customerId: id, eventType: 'PORTAL_IDENTITY_UNLINKED', source: 'MANUAL', userId: userId! })
        await prisma.adminAuditLog.create({
          data: { action: 'UNLINK_PORTAL_IDENTITY', entity: 'Customer', entityId: id, adminId: userId! },
        })
        return NextResponse.json({ ok: true })
      }
    }
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    if (err instanceof PortalInviteError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[admin/customers/:id/portal-invite PATCH]', err)
    return NextResponse.json({ error: 'Failed to update portal access' }, { status: 400 })
  }
}
