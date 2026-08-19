// Admin -> Promotions -> Conversion Dashboard (2026-08-19 lead-capture/
// conversion engine, section 21/22). Real, DB-derived campaign-performance
// comparison -- every campaign stays queryable here after the current
// acquisition offer changes, since PromotionCode/CampaignFunnelEvent rows
// are never deleted when a campaign is retired/archived.
export const dynamic = 'force-dynamic'

import { isCurrentUserAdmin } from '@/lib/auth/rbac'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCampaignConversionReport } from '@/lib/promotions/conversionDashboard'
import { CampaignConversionTable } from '@/components/admin/CampaignConversionTable'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default async function ConversionDashboardPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect('/')
  }

  const rows = await getCampaignConversionReport()

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1600px] mx-auto">
        <AdminPageHeader
          title="Conversion Dashboard"
          subtitle="Campaign performance, compared over time · Pepscore Lab"
          actions={
            <Link
              href="/admin/promotions"
              className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
            >
              ← Campaigns
            </Link>
          }
        />

        <div className="bg-white/[0.03] border border-gold/10 rounded-[18px] overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <p className="text-[12px] text-white/50">
              Popup impressions/dismissals are logged only while the auto-triggered popup is enabled (Settings →
              Acquisition Popup) — a campaign shown only via the manual &quot;Claim&quot; link will show 0 impressions
              here even with real leads/codes, since impression logging is specific to the auto-popup surface.
              Capture rate and revenue are never estimated — a metric with no underlying data shows as &ldquo;—&rdquo;.
            </p>
          </div>
          <CampaignConversionTable rows={rows} />
        </div>
      </div>
    </main>
  )
}
