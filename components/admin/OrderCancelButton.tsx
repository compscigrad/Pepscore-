// Two-click arm/confirm cancel action for a storefront Order (Phase 4A
// Critical #4) -- no native confirm() dialog, matching this app's existing
// interaction convention (Decision #20). Always calls the dedicated cancel
// endpoint, never a bare status PATCH, so the reservation-release/payment-
// check lifecycle always runs.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { pillOutline } from '@/components/invoices/theme'

export function OrderCancelButton({ orderId, disabled, disabledReason }: { orderId: string; disabled?: boolean; disabledReason?: string }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled from admin order detail' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to cancel order')

      toast.success(data.alreadyCancelled ? 'Order was already cancelled' : 'Order cancelled — outstanding reservations released')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order')
    } finally {
      setCancelling(false)
      setArmed(false)
    }
  }

  if (disabled) {
    return (
      <div className="text-right">
        <button type="button" disabled className={`${pillOutline} px-4 py-2 opacity-40 cursor-not-allowed`}>
          Cancel Order
        </button>
        {disabledReason ? <p className="text-[11px] text-white/40 mt-1 max-w-[240px]">{disabledReason}</p> : null}
      </div>
    )
  }

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={`${pillOutline} px-4 py-2 border-red-400/30 text-red-300 hover:bg-red-400/10`}>
        Cancel Order
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleCancel} disabled={cancelling} className="px-4 py-2 rounded-full bg-red-400/20 text-red-300 text-sm font-bold hover:bg-red-400/30 disabled:opacity-50">
        {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
      </button>
      <button type="button" onClick={() => setArmed(false)} disabled={cancelling} className="text-white/50 hover:text-white text-sm">
        Never mind
      </button>
    </div>
  )
}
