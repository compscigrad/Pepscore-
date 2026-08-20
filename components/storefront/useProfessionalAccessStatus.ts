'use client'

import { useEffect, useState } from 'react'

// Shared by CartSidebar and CheckoutForm so both suppress standard volume-
// tier messaging for a Professional-eligible visitor without each
// duplicating the fetch. Starts `null` (unknown) rather than `false`, so
// callers can avoid a flash of standard-tier messaging before the real
// status loads -- treat `null` the same as `false` (don't show Professional-
// only content) but `false` !== "definitely not eligible yet confirmed."
export function useProfessionalAccessStatus(): boolean | null {
  const [proEligible, setProEligible] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/professional-access/status')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setProEligible(!!data.proEligible)
      })
      .catch(() => {
        if (!cancelled) setProEligible(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return proEligible
}
