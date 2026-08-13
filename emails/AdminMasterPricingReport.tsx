// Admin-only master pricing report -- sent exactly once, only after the
// owner explicitly approves a pricing revision pass. Never automated,
// never customer-visible. Summarizes the pass; the full per-SKU table
// ships as a CSV attachment (docs/MasterPricingList-*.csv) rather than
// inlined, since a 100+-row table doesn't render usefully in an email
// client.
import { ADMIN_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface PricingDiffRow {
  name: string
  size: string
  oldStandard: number | null
  newStandard: number
  oldSpa: number | null
  newSpa: number
  reason: string
}

interface AdminMasterPricingReportProps {
  generatedAt: Date
  totalActiveProducts: number
  changedCount: number
  retatrutideStandard: number
  retatrutideSpa: number
  retatrutideRatio: number
  topChanges: PricingDiffRow[] // a representative sample, not the full table
}

export function adminMasterPricingReportSubject(): string {
  return `Master Pricing Report — approved 2026-08-12 pricing revision`
}

export function buildAdminMasterPricingReportHtml({
  generatedAt,
  totalActiveProducts,
  changedCount,
  retatrutideStandard,
  retatrutideSpa,
  retatrutideRatio,
  topChanges,
}: AdminMasterPricingReportProps): string {
  const summaryPanel = emailPanel(`
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Active products:</strong> ${totalActiveProducts}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Products with a pricing change this pass:</strong> ${changedCount}</p>
    <p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Retatrutide SPA reference:</strong> Standard $${retatrutideStandard} / SPA $${retatrutideSpa} (${(retatrutideRatio * 100).toFixed(1)}%)</p>
  `)

  const rowsHtml = topChanges
    .map(
      (r) => `
    <tr>
      <td style="padding:6px 10px;font-size:13px;color:${EMAIL_COLORS.textPrimary};border-top:1px solid ${EMAIL_COLORS.border}">${escapeHtml(r.name)} ${escapeHtml(r.size)}</td>
      <td style="padding:6px 10px;font-size:13px;color:${EMAIL_COLORS.textSecondary};border-top:1px solid ${EMAIL_COLORS.border}">$${r.oldStandard ?? '—'} → $${r.newStandard}</td>
      <td style="padding:6px 10px;font-size:13px;color:${EMAIL_COLORS.textSecondary};border-top:1px solid ${EMAIL_COLORS.border}">$${r.oldSpa ?? '—'} → $${r.newSpa}</td>
      <td style="padding:6px 10px;font-size:12px;color:${EMAIL_COLORS.textMuted};border-top:1px solid ${EMAIL_COLORS.border}">${escapeHtml(r.reason)}</td>
    </tr>`
    )
    .join('')

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px;text-align:center">Master Pricing Report</h2>
    <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;text-align:center;margin:0 0 16px">Generated ${generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} — full detail attached as CSV</p>
    ${summaryPanel}
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_COLORS.gold}">Product</th>
          <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_COLORS.gold}">Standard Case</th>
          <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_COLORS.gold}">SPA Case</th>
          <th style="text-align:left;padding:6px 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${EMAIL_COLORS.gold}">Reason</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="color:${EMAIL_COLORS.textMuted};font-size:12px;line-height:1.6;text-align:center;margin-top:20px">
      This is an internal pricing record, not for public distribution. See the attached CSV for every active SKU, including hidden Single Vial rates for products where public sales are currently disabled.
    </p>
  `

  return buildEmailShell({ eyebrow: 'Internal — Pricing', bodyHtml, footerNote: `Internal admin report · ${ADMIN_EMAIL}` })
}
