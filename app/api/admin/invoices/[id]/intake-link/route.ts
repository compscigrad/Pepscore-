// POST  /api/admin/invoices/[id]/intake-link — generate-or-return-the-
//        existing-active-link (requirement 11's duplicate-link safeguard).
// PATCH { action: 'regenerate' | 'invalidate' } — admin controls over the
//        most recent link for this invoice, whatever its current state.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateIntakeLink, findActiveIntakeLinkFor, regenerateIntakeLink, invalidateIntakeLink } from '@/lib/intakeLinks'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const existing = await findActiveIntakeLinkFor({ customerId: invoice.customerId, invoiceId: invoice.id })
  if (existing) {
    return NextResponse.json({ link: existing, reused: true })
  }

  const link = await generateIntakeLink({ customerId: invoice.customerId, invoiceId: invoice.id, createdBy: userId! })
  return NextResponse.json({ link, reused: false })
}

const patchSchema = z.object({ action: z.enum(['regenerate', 'invalidate']) })

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const { action } = patchSchema.parse(body)

    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const mostRecent = await prisma.intakeLink.findFirst({
      where: {
        OR: [{ invoiceId: id }, ...(invoice.customerId ? [{ customerId: invoice.customerId }] : [])],
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!mostRecent) {
      return NextResponse.json({ error: 'No intake link exists for this invoice yet.' }, { status: 404 })
    }

    if (action === 'invalidate') {
      await invalidateIntakeLink(mostRecent.id)
      return NextResponse.json({ ok: true })
    }

    const link = await regenerateIntakeLink(mostRecent.id, userId!)
    return NextResponse.json({ link })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/[id]/intake-link PATCH]', err)
    return NextResponse.json({ error: 'Failed to update the intake link' }, { status: 500 })
  }
}
