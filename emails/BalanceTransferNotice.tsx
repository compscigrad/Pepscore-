// Sent when an admin moves a remaining balance from one invoice onto
// another (lib/balanceTransfers.ts) — explains clearly which invoice the
// balance moved from/to and what the customer owes now, per the sprint's
// "customer communications explain clearly" requirement.
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export interface BalanceTransferNoticeProps {
  customerName: string
  amount: number
  sourceInvoiceNumber: string
  destinationInvoiceNumber: string
  destinationBalanceDue: number
}

export function balanceTransferNoticeSubject(destinationInvoiceNumber: string): string {
  return `Your Balance Has Been Moved — Invoice #${destinationInvoiceNumber}`
}

export function buildBalanceTransferNoticeHtml(props: BalanceTransferNoticeProps): string {
  const summaryPanel = emailPanel(
    `<p style="margin:0;font-size:13px;line-height:1.8;color:${EMAIL_COLORS.textSecondary}"><strong style="color:${EMAIL_COLORS.textPrimary}">Current balance due on #${escapeHtml(props.destinationInvoiceNumber)}:</strong> ${formatMoney(props.destinationBalanceDue)}</p>`
  )

  const bodyHtml = `
    <h2 style="font-size:19px;color:${EMAIL_COLORS.textPrimary};margin:0 0 14px">Hi ${escapeHtml(props.customerName)},</h2>
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      A remaining balance of <strong>${formatMoney(props.amount)}</strong> from invoice
      <strong>#${escapeHtml(props.sourceInvoiceNumber)}</strong> has been moved onto invoice
      <strong>#${escapeHtml(props.destinationInvoiceNumber)}</strong>. Invoice #${escapeHtml(props.sourceInvoiceNumber)} no longer has a
      balance owed on it — going forward, please use invoice #${escapeHtml(props.destinationInvoiceNumber)} for this amount.
    </p>
    ${summaryPanel}
    <p style="font-size:14px;line-height:1.7;color:${EMAIL_COLORS.textSecondary}">
      Reach out anytime at ${BILLING_EMAIL} with questions about either invoice.
    </p>
  `
  return buildEmailShell({ eyebrow: 'Balance Transfer', bodyHtml, footerNote: `Questions? Reply to this email or contact ${BILLING_EMAIL}.` })
}
