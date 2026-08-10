// Order confirmation email HTML builder
// Returns a plain HTML string — no React rendering dependency required
// Migrated onto the shared PepScore Lab email shell (docs/Decisions.md) --
// content and send logic unchanged, presentation only.
import { ORDERS_EMAIL } from '@/lib/resend'
import { buildEmailShell, escapeHtml, EMAIL_COLORS } from '@/emails/shared/shell'

interface OrderItem {
  name: string
  size: string
  quantity: number
  unitPrice: number
}

interface OrderConfirmationProps {
  orderNumber: string
  customerName: string
  items: OrderItem[]
  subtotal: number
  shippingCost: number
  total: number
  invoiceNumber: string
}

export function buildOrderConfirmationHtml(props: OrderConfirmationProps): string {
  const { orderNumber, customerName, items, subtotal, shippingCost, total, invoiceNumber } = props

  const itemRows = items
    .map(
      (item) => `
    <tr style="border-bottom:1px solid ${EMAIL_COLORS.border}">
      <td style="padding:12px 14px;font-size:14px;color:${EMAIL_COLORS.textPrimary}">
        <strong>${escapeHtml(item.name)}</strong><br>
        <span style="font-size:12px;color:${EMAIL_COLORS.textMuted}">${escapeHtml(item.size)} · For Research Only</span>
      </td>
      <td style="padding:12px 14px;text-align:center;font-size:14px;color:${EMAIL_COLORS.textPrimary}">${item.quantity}</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px;color:${EMAIL_COLORS.textPrimary}">
        $${(item.unitPrice * item.quantity).toFixed(2)}
      </td>
    </tr>
  `
    )
    .join('')

  const bodyHtml = `
    <h2 style="font-size:20px;color:${EMAIL_COLORS.textPrimary};margin:0 0 8px">Order Confirmed</h2>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:15px;line-height:1.6">Thank you, ${escapeHtml(customerName)}. Your order <strong>${escapeHtml(orderNumber)}</strong> has been received and is being processed.</p>
    <p style="color:${EMAIL_COLORS.textSecondary};font-size:14px;line-height:1.6">Invoice: <strong>${escapeHtml(invoiceNumber)}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-top:24px">
      <thead>
        <tr style="background:${EMAIL_COLORS.panelBg}">
          <th style="padding:10px 14px;text-align:left;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted}">Product</th>
          <th style="padding:10px 14px;text-align:center;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted}">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted}">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="margin-top:16px;padding-top:16px;border-top:2px solid ${EMAIL_COLORS.border}">
      <div style="display:flex;justify-content:space-between;font-size:13px;color:${EMAIL_COLORS.textMuted};margin-bottom:6px">
        <span>Subtotal</span><span>$${subtotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;color:${EMAIL_COLORS.textMuted};margin-bottom:6px">
        <span>Shipping</span><span>${shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;color:${EMAIL_COLORS.textPrimary};margin-top:8px">
        <span>Total</span><span style="color:${EMAIL_COLORS.gold}">$${total.toFixed(2)}</span>
      </div>
    </div>
  `

  return buildEmailShell({
    eyebrow: 'Holistic Research Peptides',
    bodyHtml,
    footerNote: `⚠️ <strong>Research Use Only.</strong> All Pepscore Lab products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Products must be handled by qualified researchers in appropriate laboratory environments. Contact ${ORDERS_EMAIL} with questions.`,
  })
}
