'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PortalClaimButton({ token }: { token: string }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function claim() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/account/claim/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not claim this account')
      router.push('/account')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim this account')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={submitting}
        className="w-full bg-gold hover:bg-gold-dark disabled:opacity-50 text-dark font-heading font-bold text-sm uppercase tracking-[0.08em] px-6 py-3 rounded-lg transition-colors"
      >
        {submitting ? 'Setting Up…' : 'Set Up My Account'}
      </button>
      {error ? <p className="text-red-300 text-sm mt-3 text-center">{error}</p> : null}
    </div>
  )
}
