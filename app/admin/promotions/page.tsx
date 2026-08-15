// Admin -> Promotions — acquisition-campaign management (Promotion
// Campaign system). Distinct from Settings > Invoice Discounts
// (app/admin/settings/invoices), which manages the older, unrelated
// per-invoice-line Promotion picker -- see prisma/schema.prisma's
// PromotionCampaign comment and docs/Decisions.md for why these are
// deliberately separate models.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { PromotionCampaignManager, type PromotionCampaignView } from '@/components/admin/PromotionCampaignManager'

export default async function AdminPromotionsPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const campaigns = await prisma.promotionCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { codes: true } } },
  })
  const redeemedCounts = await prisma.promotionCode.groupBy({
    by: ['campaignId'],
    where: { status: 'REDEEMED' },
    _count: { _all: true },
  })
  const redeemedByCampaign = new Map(redeemedCounts.map((r) => [r.campaignId, r._count._all]))

  const view: PromotionCampaignView[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    publicTitle: c.publicTitle,
    publicDescription: c.publicDescription,
    discountType: c.discountType,
    discountValue: c.discountValue,
    status: c.status,
    startsAt: c.startsAt ? c.startsAt.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    isDefaultFirstOrderCampaign: c.isDefaultFirstOrderCampaign,
    firstOrderOnly: c.firstOrderOnly,
    stackingPolicy: c.stackingPolicy,
    createdAt: c.createdAt.toISOString(),
    codeCount: c._count.codes,
    redeemedCount: redeemedByCampaign.get(c.id) ?? 0,
  }))

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Promotions</h1>
            <p className="text-white/50 text-sm mt-1">Acquisition campaigns · Pepscore Lab</p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/admin/settings/first-order-offer"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              FIRST10 Legacy Settings
            </Link>
            <Link
              href="/admin/invoices"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Invoices
            </Link>
          </div>
        </div>

        <PromotionCampaignManager campaigns={view} />
      </div>
    </main>
  )
}
