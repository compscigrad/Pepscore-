// POST  /api/admin/invoices/[id]/intake-link — generate-or-return-the-
//        existing-active-link (requirement 11's duplicate-link safeguard).
// PATCH { action: 'regenerate' | 'invalidate' } — admin controls over the
//        most recent link for this invoice, whatever its current state.
// PATCH { action: 'send', channel: 'email' | 'sms' } — deliver the current
//        active link directly to the customer's email/phone on file.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateIntakeLink, findActiveIntakeLinkFor, regenerateIntakeLink, invalidateIntakeLink } from '@/lib/intakeLinks'
import { sendIntakeLinkEmail, sendIntakeLinkSms } from '@/lib/intake/delivery'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

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

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('invalidate') }),
  z.object({ action: z.literal('send'), channel: z.enum(['email', 'sms']) }),
])

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { id } = await params

  try {
    const body = await req.json()
    const parsed = patchSchema.parse(body)

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

    if (parsed.action === 'invalidate') {
      await invalidateIntakeLink(mostRecent.id)
      return NextResponse.json({ ok: true })
    }

    if (parsed.action === 'regenerate') {
      const link = await regenerateIntakeLink(mostRecent.id, userId!)
      return NextResponse.json({ link })
    }

    // action === 'send'
    const rateLimit = checkRateLimit(`intake-link-send:${getClientIp(req)}`, 20, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests, please try again shortly.' }, { status: 429 })
    }

    const sendInput = {
      token: mostRecent.token,
      link: `${APP_URL}/intake/${mostRecent.token}`,
      customerName: invoice.customerName,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
    }

    if (parsed.channel === 'email') {
      await sendIntakeLinkEmail(sendInput)
    } else {
      await sendIntakeLinkSms(sendInput)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    console.error('[admin/invoices/[id]/intake-link PATCH]', err)
    const message = err instanceof Error ? err.message : 'Failed to update the intake link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
