'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ProfessionalAccessInviteButton({ token }: { token: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/professional-access/invite/${token}/claim`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not accept this invitation')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this invitation')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={submitting}
        className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] disabled:opacity-50 text-black font-heading font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-full transition-all"
      >
        {submitting ? 'Activating…' : 'Accept Invitation'}
      </button>
      {error ? <p className="text-red-300 text-sm mt-3 text-center">{error}</p> : null}
    </div>
  )
}
