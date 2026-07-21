// Display formatting shared by the PDF documents and the live HTML preview.
// Framework-agnostic (no react-pdf or DOM dependency) so both can import it
// without pulling the other's runtime along.

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

// Dates stored on Invoice (issuedAt, shipDate, deliveredDate, payment.paidAt)
// represent a calendar date, not a moment in time. Formatting in the
// viewer's local timezone can roll the displayed day back or forward from
// what was actually stored (e.g. a UTC-midnight Date rendering as the
// previous day in a US timezone) — forcing UTC keeps the printed date
// stable regardless of where/when it's viewed.
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// PICKUP/HAND_DELIVERY read as internal carrier-enum jargon ("HAND
// DELIVERY") if just underscore-replaced — override with the wording the
// business actually uses. Shared by the PDF documents, the live preview, and
// the dashboard table so a client never sees the raw enum value.
const CARRIER_LABELS: Record<string, string> = {
  PICKUP: 'Scheduled Pickup',
  HAND_DELIVERY: 'Self Delivery',
}

export function formatCarrierLabel(carrier: string): string {
  return CARRIER_LABELS[carrier] ?? carrier.replace('_', ' ')
}

// Catalog products share names across strengths (e.g. "Tesamorelin" 5mg and
// 10mg) — the raw name alone is ambiguous in a dropdown and, worse, was
// previously the only thing carried onto the invoice line item, silently
// dropping the strength. This composed label is used both for the
// product-picker options and as the persisted line-item name, so the
// dropdown, the live preview, and the PDF always show the same identifying
// text. Every catalog product is priced and sold per box (see
// prisma/seed.ts), so "1 Box" is a real unit, not a placeholder.
export function formatProductLabel(product: { name: string; size: string }): string {
  return `${product.name} — ${product.size} — 1 Box`
}
