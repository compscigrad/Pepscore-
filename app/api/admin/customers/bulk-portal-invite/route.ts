// POST /api/admin/customers/bulk-portal-invite
// body: { customerIds: string[], mode: 'preview' | 'send' }
// 2026-08-19 lead-capture/conversion engine addendum, section 8-11.
// 'preview' never sends anything -- it's the required breakdown Admin
// must see before a real send. 'send' still runs through the exact same
// rollout safety gates (kill switch/dry-run/allowlist) as the automated
// cron, so a real production send requires the same explicit owner-set
// env configuration either way.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { previewBulkInvite, runBulkInvite } from '@/lib/portal/bulkInvite'

const bodySchema = z.object({
  customerIds: z.array(z.string().trim().min(1)).min(1).max(500),
  mode: z.enum(['preview', 'send']),
})

export async function POST(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.mode === 'preview') {
    const rows = await previewBulkInvite(parsed.data.customerIds)
    return NextResponse.json({ rows })
  }

  const result = await runBulkInvite(parsed.data.customerIds, userId as string)
  return NextResponse.json(result)
}
