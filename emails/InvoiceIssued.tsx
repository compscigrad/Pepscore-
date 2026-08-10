// "Here's your invoice" email — sent once, automatically, the first time an
// invoice reaches Issued/Pending (see lib/invoices.ts), or manually anytime
// via the "Email Invoice to Customer" button. Same branding as
// emails/InvoiceShipmentUpdate.tsx; the full line-item detail lives in the
// attached Client Invoice PDF, not duplicated here — but unlike the PDF, this
// email is where the client's secure link (for payment selection / an
// arrangement request, when a balance remains) actually lives, per
// docs/Decisions.md's three-way branch (unpaid / partially paid / paid).
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { BILLING_EMAIL } from '@/lib/resend'
import { buildEmailShell, emailCta, emailCtaOutline, emailPanel, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface InvoiceIssuedProps {
  customerName: string
  invoiceNumber: string
  total: number
  amountPaid: number
  balanceDue: number
  // Null only for the rare manually-built invoice issued with no intake
  // link ever generated and none mintable at send time — the email still
  // sends, just without a CTA link, rather than blocking the notification.
  secureLink: string | null
  // Set only when this is a revision of an already-sent invoice (the total
  // changed after the client already received it) — swaps the headline/intro
  // to say so and shows what the total used to be, rather than silently
  // reusing the "here's your invoice" framing for a change they haven't seen.
  previousTotal?: number
}

export function invoiceIssuedSubject(invoiceNumber: string): string {
  return `Your Invoice — #${invoiceNumber}`
}

export function invoiceRevisedSubject(invoiceNumber: string): string {
  return `Your Invoice Has Been Updated — #${invoiceNumber}`
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function buildInvoiceIssuedHtml({
  customerName,
  invoiceNumber,
  total,
  amountPaid,
  balanceDue,
  secureLink,
  previousTotal,
}: InvoiceIssuedProps): string {
  const isRevision = previousTotal !== undefined && previousTotal !== total

  const statusLine =
    balanceDue <= 0
      ? `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Status:</strong> Paid in full</p>`
      : amountPaid > 0
        ? `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Status:</strong> Partially paid — ${formatMoney(balanceDue)} remaining</p>`
        : `<p style="margin:0;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Status:</strong> Payment due</p>`

  const ctaBlock =
    balanceDue > 0 && secureLink
      ? `<p style="color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.6">
           Please use your secure client link to review the invoice and submit either your intended payment method for
           Pay in Full, or a payment-arrangement request.
         </p>
         ${emailCta(secureLink, 'Review Invoice & Choose Payment')}
         <p style="color:${EMAIL_COLORS.textMuted};font-size:11px;line-height:1.6">
           Submitting a payment selection or arrangement request does not confirm that payment has been received.
         </p>`
      : balanceDue > 0
        ? `<p style="color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.6">
             Reply to this email or contact ${BILLING_EMAIL} to arrange payment for the balance shown above.
           </p>`
        : secureLink
          ? `${emailCtaOutline(secureLink, 'View Invoice & Order Details')}
             <p style="color:${EMAIL_COLORS.textMuted};font-size:11px;line-height:1.6;text-align:center">No additional payment selection is required.</p>`
          : ''

  const summaryPanel = emailPanel(`
    <p style="margin:0 0 8px;font-size:11px;color:${EMAIL_COLORS.textMuted};text-transform:uppercase;letter-spacing:0.1em">Summary</p>
    ${isRevision ? `<p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textMuted}"><strong>Previous Total:</strong> ${formatMoney(previousTotal!)}</p>` : ''}
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>${isRevision ? 'New Total' : 'Total'}:</strong> ${formatMoney(total)}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Amount Paid:</strong> ${formatMoney(amountPaid)}</p>
    <p style="margin:0 0 4px;font-size:15px;color:${EMAIL_COLORS.textPrimary}"><strong>Balance Due:</strong> ${formatMoney(balanceDue)}</p>
    ${statusLine}
  `)

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">
      ${isRevision ? 'Your Invoice Has Been Updated' : balanceDue <= 0 ? 'Your Invoice Is Ready — Payment Recorded' : 'Your Invoice Is Ready'}
    </h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6;margin:0">
      Hi ${escapeHtml(customerName)}, ${isRevision ? 'invoice' : "here's invoice"} <strong>${escapeHtml(invoiceNumber)}</strong>${isRevision ? ' has been revised.' : '.'}
    </p>
    ${summaryPanel}
    ${ctaBlock}
    <p style="color:${EMAIL_COLORS.textMuted};font-size:13px;line-height:1.6;margin-top:16px">
      The full invoice — including itemized charges${balanceDue > 0 ? ', payment status,' : ''} and shipment tracking once available — is attached as a PDF.
    </p>
  `

  return buildEmailShell({
    eyebrow: 'Invoice',
    bodyHtml,
    footerNote: `Questions about this invoice? Reply to this email or contact ${BILLING_EMAIL}.`,
  })
}
