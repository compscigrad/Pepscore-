// Shared status pill for invoice status and delivery status — one component,
// two color maps, so status styling never needs reinventing per table/page.
// Follows the STATUS_COLORS pattern already established in
// components/admin/AdminOrdersTable.tsx for the Order status column.

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  ISSUED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-600',
  REFUNDED: 'bg-orange-100 text-orange-600',
  VOID: 'bg-gray-100 text-gray-500',
}

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  PREPARING: 'bg-gray-100 text-gray-600',
  PACKED: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  RETURNED: 'bg-orange-100 text-orange-600',
  LOST: 'bg-red-100 text-red-600',
  DAMAGED: 'bg-red-100 text-red-600',
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
  const className = colors[status] ?? 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${className}`}>
      {formatLabel(status)}
    </span>
  )
}
