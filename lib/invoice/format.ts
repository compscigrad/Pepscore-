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
