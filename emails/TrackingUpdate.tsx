// Tracking update email HTML builder
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { ORDERS_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface TrackingUpdateProps {
  customerName: string
  orderNumber: string
  carrier: string
  trackingNumber: string
  trackingUrl: string
}

export function buildTrackingUpdateHtml(props: TrackingUpdateProps): string {
  const { customerName, orderNumber, carrier, trackingNumber, trackingUrl } = props

  const trackingPanel = emailPanel(`
    <p style="margin:0 0 8px;font-size:11px;color:${EMAIL_COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em">Tracking Information</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Carrier:</strong> ${escapeHtml(carrier)}</p>
    <p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Tracking #:</strong> <a href="${trackingUrl}" style="color:${EMAIL_COLORS.gold}">${escapeHtml(trackingNumber)}</a></p>
  `)

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Your Order Has Shipped</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6">
      Hi ${escapeHtml(customerName)}, your Pepscore Lab order <strong>${escapeHtml(orderNumber)}</strong> has been shipped.
    </p>
    ${trackingPanel}
    ${emailCta(trackingUrl, 'Track Your Package')}
  `

  return buildEmailShell({
    eyebrow: 'Your Order Is On Its Way',
    bodyHtml,
    footerNote: `⚠️ <strong>Research Use Only.</strong> All Pepscore Lab products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Contact ${ORDERS_EMAIL} with questions.`,
  })
}
