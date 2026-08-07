// Admin notification for a storefront lead-capture submission (Phase 2B
// item 7). Same plain-HTML-string shell pattern as emails/ContactInquiry.tsx,
// with the current "Pepscore Lab" brand name and dark theme (this is a new
// template, not a historical snapshot, so it follows the current branding
// correction rather than the older cream/gold shell some existing templates
// still use).
const CONTENT_BG = '#0d0d0d'
const CARD_BG = '#161616'
const GOLD = '#D4AF37'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

const INTEREST_TYPE_LABEL: Record<string, string> = {
  GENERAL_UPDATES: 'General Updates',
  LAUNCH_NOTIFICATION: 'Launch Notification',
  PRODUCT_INTEREST: 'Product Interest',
  NOTIFY_WHEN_AVAILABLE: 'Notify When Available',
  OUT_OF_STOCK_INTEREST: 'Out of Stock Interest',
  PRICING_REVIEW_INTEREST: 'Pricing Review Interest',
  SPA_WHOLESALE_INQUIRY: 'SPA / Wholesale Inquiry',
}

export interface LeadCapturedProps {
  name: string
  email?: string | null
  phone?: string | null
  interestType: string
  productName?: string | null
  productSize?: string | null
  message?: string | null
  sourcePage: string
  isNewCustomer: boolean
}

export function leadCapturedSubject(props: LeadCapturedProps): string {
  const label = INTEREST_TYPE_LABEL[props.interestType] ?? props.interestType
  return `New Lead — ${oneLine(props.name)} (${label})`
}

export function buildLeadCapturedHtml(props: LeadCapturedProps): string {
  const label = INTEREST_TYPE_LABEL[props.interestType] ?? props.interestType
  return `<!DOCTYPE html>
<html>
<body style="font-family:Helvetica,Arial,sans-serif;background:#000;color:#fff;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:${CONTENT_BG};border-radius:12px;overflow:hidden">
    <div style="background:#000;padding:26px 36px;text-align:center;border-bottom:1px solid rgba(212,175,55,0.15)">
      <span style="font-size:20px;font-weight:800;color:#fff">Pepscore</span>
      <span style="font-size:20px;font-weight:800;color:${GOLD}"> Lab</span>
    </div>
    <div style="padding:32px 36px">
      <h2 style="font-size:18px;margin:0 0 14px;color:#fff">New storefront lead${props.isNewCustomer ? ' (new customer)' : ' (existing customer)'}</h2>
      <div style="background:${CARD_BG};border:1px solid rgba(212,175,55,0.15);border-radius:10px;padding:18px 20px;margin:0 0 18px;font-size:13px;line-height:1.9;color:rgba(255,255,255,0.75)">
        <p style="margin:0"><strong style="color:#fff">Interest:</strong> ${escapeHtml(label)}</p>
        <p style="margin:0"><strong style="color:#fff">Name:</strong> ${escapeHtml(props.name)}</p>
        ${props.email ? `<p style="margin:0"><strong style="color:#fff">Email:</strong> ${escapeHtml(props.email)}</p>` : ''}
        ${props.phone ? `<p style="margin:0"><strong style="color:#fff">Phone:</strong> ${escapeHtml(props.phone)}</p>` : ''}
        ${props.productName ? `<p style="margin:0"><strong style="color:#fff">Product:</strong> ${escapeHtml(props.productName)}${props.productSize ? ` (${escapeHtml(props.productSize)})` : ''}</p>` : ''}
        <p style="margin:0"><strong style="color:#fff">Source page:</strong> ${escapeHtml(props.sourcePage)}</p>
      </div>
      ${props.message ? `<p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,0.75);white-space:pre-wrap">${escapeHtml(props.message)}</p>` : ''}
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:18px">View full lead details and attribution in the admin customer profile.</p>
    </div>
  </div>
</body>
</html>`
}
