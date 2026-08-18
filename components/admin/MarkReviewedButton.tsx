'use client'

// AI-1.9 -- closes the review-queue loop on the AI Control Panel: the
// queue was read-only in AI-1.4 by deliberate scope decision, but a queue
// nothing can ever clear isn't a real compliance-review capability.
// Matches components/admin/InventoryDetailPanel.tsx's fetch + router.refresh()
// pattern for a small admin mutation.
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MarkReviewedButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function markReviewed() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/ai/compliance-events/${eventId}/review`, { method: 'PATCH' })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={markReviewed}
      disabled={busy}
      className="text-[11px] font-heading font-bold uppercase tracking-wide text-white/50 hover:text-gold transition-colors disabled:opacity-40"
    >
      {busy ? 'Marking…' : 'Mark Reviewed'}
    </button>
  )
}
