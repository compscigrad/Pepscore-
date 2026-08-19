// Admin conversion dashboard (2026-08-19 lead-capture/conversion engine,
// section 21/22) -- every number here is derived directly from canonical
// models (PromotionCampaign/PromotionCode/CampaignFunnelEvent/Invoice/
// Order), never fabricated or estimated. A metric with no underlying data
// (e.g. capture rate with zero impressions logged) is reported as `null`,
// not a guessed/zero value the caller renders as "—" -- see
// docs/finance/... convention of "report the real value, including
// unavailable, rather than approximate."
import { prisma } from '@/lib/prisma'

export interface CampaignConversionRow {
  campaignId: string
  name: string
  publicTitle: string
  status: string
  popupImpressions: number
  popupDismissed: number
  leadsCaptured: number // = codes issued, this offer type issues exactly one code per capture
  codesIssued: number
  codesRedeemed: number
  codesExpiredOrRevoked: number
  captureRate: number | null // leadsCaptured / popupImpressions, null if zero impressions logged
  redemptionRate: number | null // codesRedeemed / codesIssued, null if zero issued
  revenueAttributed: number // sum of Invoice.total + Order.total for redeemed codes
  averageOrderValue: number | null // revenueAttributed / codesRedeemed, null if zero redeemed
}

export async function getCampaignConversionReport(): Promise<CampaignConversionRow[]> {
  const campaigns = await prisma.promotionCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      codes: {
        select: { status: true, redeemedInvoiceId: true, redeemedOrderId: true },
      },
      funnelEvents: { select: { eventType: true } },
    },
  })

  // Revenue attribution needs a batch lookup against Invoice/Order totals
  // for every redeemed code across every campaign -- done once, up front,
  // rather than per-campaign, to avoid an N+1 query pattern.
  const redeemedInvoiceIds = campaigns.flatMap((c) => c.codes.map((code) => code.redeemedInvoiceId).filter((id): id is string => Boolean(id)))
  const redeemedOrderIds = campaigns.flatMap((c) => c.codes.map((code) => code.redeemedOrderId).filter((id): id is string => Boolean(id)))

  const [invoices, orders] = await Promise.all([
    redeemedInvoiceIds.length
      ? prisma.invoice.findMany({ where: { id: { in: redeemedInvoiceIds } }, select: { id: true, total: true } })
      : Promise.resolve([]),
    redeemedOrderIds.length
      ? prisma.order.findMany({ where: { id: { in: redeemedOrderIds } }, select: { id: true, total: true } })
      : Promise.resolve([]),
  ])
  const invoiceTotalById = new Map(invoices.map((i) => [i.id, i.total]))
  const orderTotalById = new Map(orders.map((o) => [o.id, o.total]))

  return campaigns.map((campaign) => {
    const popupImpressions = campaign.funnelEvents.filter((e) => e.eventType === 'POPUP_IMPRESSION').length
    const popupDismissed = campaign.funnelEvents.filter((e) => e.eventType === 'POPUP_DISMISSED').length
    const codesIssued = campaign.codes.length
    const codesRedeemed = campaign.codes.filter((c) => c.status === 'REDEEMED').length
    const codesExpiredOrRevoked = campaign.codes.filter((c) => c.status === 'EXPIRED' || c.status === 'REVOKED').length

    const revenueAttributed = campaign.codes.reduce((sum, code) => {
      if (code.redeemedInvoiceId) sum += invoiceTotalById.get(code.redeemedInvoiceId) ?? 0
      if (code.redeemedOrderId) sum += orderTotalById.get(code.redeemedOrderId) ?? 0
      return sum
    }, 0)

    return {
      campaignId: campaign.id,
      name: campaign.name,
      publicTitle: campaign.publicTitle,
      status: campaign.status,
      popupImpressions,
      popupDismissed,
      leadsCaptured: codesIssued,
      codesIssued,
      codesRedeemed,
      codesExpiredOrRevoked,
      captureRate: popupImpressions > 0 ? codesIssued / popupImpressions : null,
      redemptionRate: codesIssued > 0 ? codesRedeemed / codesIssued : null,
      revenueAttributed,
      averageOrderValue: codesRedeemed > 0 ? revenueAttributed / codesRedeemed : null,
    }
  })
}
