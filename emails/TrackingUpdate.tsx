// Tracking update email HTML builder

interface TrackingUpdateProps {
  customerName: string
  orderNumber: string
  carrier: string
  trackingNumber: string
  trackingUrl: string
}

export function buildTrackingUpdateHtml(props: TrackingUpdateProps): string {
  const { customerName, orderNumber, carrier, trackingNumber, trackingUrl } = props
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;background:#FAFAF5;color:#1A1A1A;margin:0;padding:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#1A1A1A;padding:28px 36px;text-align:center">
      <h1 style="color:#C49A1A;font-family:Helvetica,sans-serif;font-size:26px;margin:0;letter-spacing:0.1em">PEPSCORE</h1>
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:6px 0 0;letter-spacing:0.12em;text-transform:uppercase">Your Order Is On Its Way</p>
    </div>
    <div style="padding:36px 36px 28px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">📦</div>
      <h2 style="font-family:Helvetica,sans-serif;font-size:22px;color:#1A1A1A;margin-bottom:8px">Your Order Has Shipped</h2>
      <p style="color:#424242;font-size:15px;line-height:1.6">
        Hi ${customerName}, your Pepscore order <strong>${orderNumber}</strong> has been shipped.
      </p>
      <div style="background:#F5F5F0;border-radius:10px;padding:20px 24px;margin:24px 0;text-align:left">
        <p style="margin:0 0 8px;font-size:13px;color:#757575;text-transform:uppercase;letter-spacing:0.1em;font-family:Helvetica,sans-serif">Tracking Information</p>
        <p style="margin:0 0 4px;font-size:15px"><strong>Carrier:</strong> ${carrier}</p>
        <p style="margin:0;font-size:15px"><strong>Tracking #:</strong> <a href="${trackingUrl}" style="color:#C49A1A">${trackingNumber}</a></p>
      </div>
      <a href="${trackingUrl}" style="display:inline-block;background:#C49A1A;color:#fff;padding:14px 32px;border-radius:6px;font-family:Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">
        Track Your Package
      </a>
    </div>
    <div style="background:#F5F5F0;padding:18px 36px;border-top:1px solid #E0DDD4">
      <p style="font-size:11px;color:#757575;line-height:1.7;margin:0">
        ⚠️ <strong>Research Use Only.</strong> All Pepscore products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use.
      </p>
    </div>
    <div style="background:#1A1A1A;padding:20px 36px;text-align:center">
      <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:0">© ${year} Pepscore · contact@pepscore.com</p>
    </div>
  </div>
</body>
</html>`
}
