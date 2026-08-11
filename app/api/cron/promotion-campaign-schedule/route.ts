// GET /api/cron/promotion-campaign-schedule — activates any SCHEDULED
// PromotionCampaign whose startsAt has arrived, so a scheduled offer
// switch (e.g. "20% First Order starts September 1") happens reliably on
// the server without the owner needing to be logged into admin at the
// scheduled moment. No communication is sent by this route itself --
// activating a campaign only changes which offer is currently the default;
// FIRST10's actual code-issuance/email/SMS flow (a separate, later slice)
// is what would ever contact a real customer, and stays gated by its own
// switches regardless of which campaign is active.
//
// Runs once daily (vercel.json, 0 16 * * *) -- this Vercel project is on
// the Hobby plan, which rejects the entire deployment if any cron is
// scheduled more frequently than daily (confirmed by a failed preview
// deployment when this was first set to run hourly), matching every other
// cron in this project.
import { NextRequest, NextResponse } from 'next/server'
import { activateDueScheduledCampaigns } from '@/lib/promotions/campaigns'
import { safeCompare } from '@/lib/security/safeCompare'

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided = req.headers.get('authorization')
  return provided !== null && safeCompare(provided, `Bearer ${secret}`)
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await activateDueScheduledCampaigns('system-cron')
  return NextResponse.json({
    activated: results.length,
    campaigns: results.map((r) => ({
      campaignId: r.campaign.id,
      name: r.campaign.name,
      previousDefaultId: r.previousDefault?.id ?? null,
      expiredCodeCount: r.expiredCodeCount,
    })),
  })
}
