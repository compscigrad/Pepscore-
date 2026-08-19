// Admin conversion dashboard table (2026-08-19 lead-capture/conversion
// engine, section 21/22). Every cell reads directly from
// getCampaignConversionReport() -- a metric with no underlying data
// renders as "—", never a fabricated 0% or $0 presented as if it were real.
import { formatCurrency } from '@/lib/orders'
import type { CampaignConversionRow } from '@/lib/promotions/conversionDashboard'

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function formatMoneyOrDash(value: number | null): string {
  return value === null ? '—' : formatCurrency(value)
}

export function CampaignConversionTable({ rows }: { rows: CampaignConversionRow[] }) {
  if (rows.length === 0) {
    return <p className="text-white/50 text-sm py-8 text-center">No campaigns yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/10">
            {['Campaign', 'Status', 'Popup Impressions', 'Popup Dismissed', 'Leads', 'Codes Issued', 'Codes Redeemed', 'Capture Rate', 'Redemption Rate', 'Revenue Attributed', 'Avg Order Value'].map((h) => (
              <th key={h} className="text-left font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaignId} className="border-b border-white/10 hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <p className="font-heading font-bold text-white whitespace-nowrap">{row.name}</p>
                <p className="text-white/40 text-xs whitespace-nowrap">{row.publicTitle}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{row.status}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{row.popupImpressions}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{row.popupDismissed}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{row.leadsCaptured}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{row.codesIssued}</td>
              <td className="px-4 py-3 whitespace-nowrap text-emerald-300 font-medium">{row.codesRedeemed}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{formatPercent(row.captureRate)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{formatPercent(row.redemptionRate)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-heading font-bold text-gold">{formatCurrency(row.revenueAttributed)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-white/70">{formatMoneyOrDash(row.averageOrderValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
