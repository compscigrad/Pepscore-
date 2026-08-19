// First-party campaign funnel event log (2026-08-19 lead-capture/
// conversion engine, section 21). See prisma/schema.prisma's
// CampaignFunnelEvent comment for why this exists as its own small table
// rather than reusing the Vercel-Analytics-backed AnalyticsEvent system.
import { prisma } from '@/lib/prisma'
import type { CampaignFunnelEventType } from '@prisma/client'

export interface LogCampaignFunnelEventInput {
  campaignId: string
  eventType: CampaignFunnelEventType
  sourcePage?: string | null
  customerId?: string | null
}

// Never throws to the caller -- a funnel-event logging failure must never
// break the popup or the claim flow it's instrumenting.
export async function logCampaignFunnelEvent(input: LogCampaignFunnelEventInput): Promise<void> {
  try {
    await prisma.campaignFunnelEvent.create({
      data: {
        campaignId: input.campaignId,
        eventType: input.eventType,
        sourcePage: input.sourcePage ?? undefined,
        customerId: input.customerId ?? undefined,
      },
    })
  } catch (err) {
    console.error('[logCampaignFunnelEvent] Failed to log funnel event:', err)
  }
}
