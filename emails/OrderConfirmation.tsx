// Order confirmation email HTML builder
// Returns a plain HTML string — no React rendering dependency required

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
  const year = new Date().getFullYear()

  const itemRows = items.map(item => `
    <tr style="border-bottom:1px solid #F5F5F0">
      <td style="padding:12px 14px;font-size:14px">
        <strong>${item.name}</strong><br>
        <span style="font-size:12px;color:#757575">${item.size} · For Research Only</span>
      </td>
      <td style="padding:12px 14px;text-align:center;font-size:14px">${item.quantity}</td>
      <td style="padding:12px 14px;text-align:right;font-size:14px">
        $${(item.unitPrice * item.quantity).toFixed(2)}
      </td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Holistic Research Peptides</p>
    </div>
    <div style="padding:36px 36px 28px">
      <h2 style="font-family:Helvetica,sans-serif;font-size:20px;color:#1A1A1A;margin-bottom:8px">Order Confirmed</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">Thank you, ${customerName}. Your order <strong>${orderNumber}</strong> has been received and is being processed.</p>
      <p style="color:#424242;font-size:14px;line-height:1.6">Invoice: <strong>${invoiceNumber}</strong></p>
      <table style="width:100%;border-collapse:collapse;margin-top:24px">
        <thead>
          <tr style="background:#F5F5F0">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-family:Helvetica,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#757575">Product</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-family:Helvetica,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#757575">Qty</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-family:Helvetica,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#757575">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:2px solid #F5F5F0">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#757575;margin-bottom:6px">
          <span>Subtotal</span><span>$${subtotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#757575;margin-bottom:6px">
          <span>Shipping</span><span>${shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;color:#1A1A1A;margin-top:8px">
          <span>Total</span><span style="color:#C49A1A">$${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        ⚠️ <strong>Research Use Only.</strong> All Pepscore products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Products must be handled by qualified researchers in appropriate laboratory environments.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · contact@pepscore.com · For research purposes only.</p>
    </div>
  </div>
</body>
</html>`
}
