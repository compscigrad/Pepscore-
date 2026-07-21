// Shared status pill for invoice status and delivery status — one component,
// two color maps, so status styling never needs reinventing per table/page.
// Outline-plus-tint style (border + low-opacity fill) rather than solid
// color chips: reads clearly against the dashboard's black background and
// follows the same hairline-border, flat-depth language as the landing
// page's cards, instead of the loud filled pills a light-theme admin would use.

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'border-white/15 bg-white/5 text-white/50',
  PENDING: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  APPROVED: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  ISSUED: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  PAID: 'border-gold/40 bg-gold/10 text-gold-light',
  PARTIALLY_PAID: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  CANCELLED: 'border-red-400/30 bg-red-400/10 text-red-300',
  REFUNDED: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  VOID: 'border-white/15 bg-white/5 text-white/40',
  ARCHIVED: 'border-white/15 bg-white/5 text-white/40',
}

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PREPARING: 'border-white/15 bg-white/5 text-white/50',
  PACKED: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  SHIPPED: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  IN_TRANSIT: 'border-purple-400/30 bg-purple-400/10 text-purple-300',
  DELIVERED: 'border-gold/40 bg-gold/10 text-gold-light',
  RETURNED: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  LOST: 'border-red-400/30 bg-red-400/10 text-red-300',
  DAMAGED: 'border-red-400/30 bg-red-400/10 text-red-300',
}

interface StatusBadgeProps {
  status: string
  variant?: 'invoice' | 'delivery'
}

function formatLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export function StatusBadge({ status, variant = 'invoice' }: StatusBadgeProps) {
  const colors = variant === 'delivery' ? DELIVERY_STATUS_COLORS : INVOICE_STATUS_COLORS
  const className = colors[status] ?? 'border-white/15 bg-white/5 text-white/50'

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${className}`}>
      {formatLabel(status)}
    </span>
  )
}
