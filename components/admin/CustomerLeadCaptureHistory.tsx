// Read-only history of every lead-capture submission this customer has
// made (Phase 2B item 8) -- product/strength interest, source/attribution,
// UTM values, consent, timestamp. Server component -- no client state.
import { card, mutedText, sectionHeading } from '@/components/invoices/theme'

export interface LeadCaptureRow {
  id: string
  interestType: string
  productName: string | null
  productSize: string | null
  productSlug: string | null
  message: string | null
  sourcePage: string
  referrer: string | null
  landingUrl: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  consent: boolean
  createdAt: Date | string
}

const INTEREST_TYPE_LABEL: Record<string, string> = {
  GENERAL_UPDATES: 'General Updates',
  LAUNCH_NOTIFICATION: 'Launch Notification',
  PRODUCT_INTEREST: 'Product Interest',
  NOTIFY_WHEN_AVAILABLE: 'Notify When Available',
  OUT_OF_STOCK_INTEREST: 'Out of Stock Interest',
  PRICING_REVIEW_INTEREST: 'Pricing Review Interest',
  SPA_WHOLESALE_INQUIRY: 'SPA / Wholesale Inquiry',
  FIRST_ORDER_OFFER: 'First-Order Offer',
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function CustomerLeadCaptureHistory({ leads }: { leads: LeadCaptureRow[] }) {
  if (leads.length === 0) return null

  return (
    <div className={`${card} p-6 space-y-4`}>
      <h3 className={sectionHeading}>Lead Capture History</h3>
      <div className="space-y-3">
        {leads.map((lead) => {
          const utm = [
            lead.utmSource && `source=${lead.utmSource}`,
            lead.utmMedium && `medium=${lead.utmMedium}`,
            lead.utmCampaign && `campaign=${lead.utmCampaign}`,
            lead.utmTerm && `term=${lead.utmTerm}`,
            lead.utmContent && `content=${lead.utmContent}`,
          ].filter(Boolean)

          return (
            <div key={lead.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-heading font-bold text-gold-light">{INTEREST_TYPE_LABEL[lead.interestType] ?? lead.interestType}</p>
                <p className={`text-xs ${mutedText}`}>{formatDate(lead.createdAt)}</p>
              </div>
              {lead.productName && (
                <p className="text-white">
                  Product: {lead.productName}
                  {lead.productSize ? ` (${lead.productSize})` : ''}
                </p>
              )}
              {lead.message && <p className="text-white/70 whitespace-pre-wrap">{lead.message}</p>}
              <p className={`text-xs ${mutedText}`}>Source page: {lead.sourcePage}</p>
              {lead.referrer && <p className={`text-xs ${mutedText}`}>Referrer: {lead.referrer}</p>}
              {lead.landingUrl && <p className={`text-xs ${mutedText}`}>First landing: {lead.landingUrl}</p>}
              {utm.length > 0 && <p className={`text-xs ${mutedText}`}>UTM: {utm.join(' · ')}</p>}
              <p className="text-xs">
                <span className={lead.consent ? 'text-green-400' : 'text-white/40'}>
                  {lead.consent ? '✓ Consented to be contacted' : '✗ No consent recorded'}
                </span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
