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

const LABEL_SOURCE_LABELS: Record<string, string> = {
  PIRATE_SHIP: 'Pirate Ship',
  SHIPPO: 'Shippo',
  USPS_DIRECT: 'USPS (direct)',
  UPS_DIRECT: 'UPS (direct)',
  FEDEX_DIRECT: 'FedEx (direct)',
  OTHER_MANUAL: 'Other / Manual',
}

export function formatLabelSourceLabel(labelSource: string): string {
  return LABEL_SOURCE_LABELS[labelSource] ?? labelSource.replace('_', ' ')
}

// Display-only US mask — never touches what's actually stored (Customer.phone
// / Invoice.customerPhone are saved exactly as typed, no normalization at
// write time). A number that doesn't parse as a US 10/11-digit number
// (already-E.164 international, or a legacy free-text value) is returned
// unchanged rather than mangled. lib/notifications/bestEffortSms.ts's
// normalizePhoneToE164 is a separate, unrelated on-the-fly transform used
// only at actual SMS send time — it never touches what's stored either.
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('1')) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return raw
}

// PaymentMethod's NA value can't be named "N/A" (enum identifiers can't
// contain a slash) — restore the slash for display everywhere the method
// is shown (dropdown, payment history, PDFs).
export function formatPaymentMethodLabel(method: string): string {
  return method === 'NA' ? 'N/A' : method.replace('_', ' ')
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
