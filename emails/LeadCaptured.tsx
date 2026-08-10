// Admin notification for a storefront lead-capture submission (Phase 2B
// item 7). Migrated onto the shared PepScore Lab email shell (Decision
// #59) -- content and send logic unchanged, presentation only. This was
// the one template left duplicating the shell's own header/colors inline
// instead of calling buildEmailShell(), found during the Phase 3D admin
// email-preview audit.
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

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

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
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

  const detailsPanel = emailPanel(`
    <p style="margin:0" ><strong style="color:${EMAIL_COLORS.textPrimary}">Interest:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(label)}</span></p>
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Name:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.name)}</span></p>
    ${props.email ? `<p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Email:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.email)}</span></p>` : ''}
    ${props.phone ? `<p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Phone:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.phone)}</span></p>` : ''}
    ${props.productName ? `<p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Product:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.productName)}${props.productSize ? ` (${escapeHtml(props.productSize)})` : ''}</span></p>` : ''}
    <p style="margin:4px 0 0"><strong style="color:${EMAIL_COLORS.textPrimary}">Source page:</strong> <span style="color:${EMAIL_COLORS.textSecondary}">${escapeHtml(props.sourcePage)}</span></p>
  `)

  const bodyHtml = `
    <h2 style="font-size:18px;margin:0 0 14px;color:${EMAIL_COLORS.textPrimary};text-align:center">New storefront lead${props.isNewCustomer ? ' (new customer)' : ' (existing customer)'}</h2>
    ${detailsPanel}
    ${props.message ? `<p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary};white-space:pre-wrap">${escapeHtml(props.message)}</p>` : ''}
  `

  return buildEmailShell({
    eyebrow: 'Admin Notification',
    bodyHtml,
    footerNote: 'View full lead details and attribution in the admin customer profile.',
  })
}
