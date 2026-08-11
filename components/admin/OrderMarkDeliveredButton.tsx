// Closes a real Phase 4D operational-friction gap: PATCH /api/admin/orders
// already supported an arbitrary status update (including DELIVERED, a
// plain low-risk record-keeping change per that route's own comment), but
// no admin UI ever called it for this specific transition -- the only way
// to mark a shipped order delivered was devtools or a direct DB edit. Only
// rendered for a SHIPPED order (the one real predecessor state); any other
// status has no button here at all rather than a disabled one, since
// PENDING/PAID/PROCESSING orders aren't deliverable yet and CANCELLED/
// REFUNDED/DELIVERED orders have nothing left to mark.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from '@/components/invoices/theme'

export function OrderMarkDeliveredButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleClick() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'DELIVERED' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update order')
      toast.success('Order marked as delivered')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      className={`${pillOutline} px-4 py-2 border-green-400/30 text-green-300 hover:bg-green-400/10 disabled:opacity-50`}
    >
      {saving ? 'Saving…' : 'Mark as Delivered'}
    </button>
  )
}
