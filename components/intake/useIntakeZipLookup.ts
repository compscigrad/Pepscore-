// Public-form counterpart to components/invoices/useZipLookup.ts — same
// debounce/dedup/never-clear-on-failure behavior, pointed at the token-gated
// public zip-lookup route instead of the admin one.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ZipLookupStatus = 'idle' | 'loading' | 'error'

export interface ZipLookupResult {
  city: string
  state: string
}

export function useIntakeZipLookup(token: string, onFound: (result: ZipLookupResult) => void) {
  const [status, setStatus] = useState<ZipLookupStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const onFoundRef = useRef(onFound)
  useEffect(() => {
    onFoundRef.current = onFound
  })
  const lastLookedUpRef = useRef<string | null>(null)

  const handleZipChange = useCallback(
    (zip: string) => {
      const zip5 = zip.replace(/\D/g, '').slice(0, 5)

      if (zip5.length < 5) {
        lastLookedUpRef.current = null
        setStatus('idle')
        setMessage(null)
        return
      }
      if (lastLookedUpRef.current === zip5) return
      lastLookedUpRef.current = zip5

      setStatus('loading')
      setMessage(null)

      fetch(`/api/intake/${token}/zip-lookup?zip=${zip5}`)
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error ?? 'ZIP code not found')
          onFoundRef.current({ city: data.city, state: data.state })
          setStatus('idle')
          setMessage(null)
        })
        .catch((err: unknown) => {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : 'ZIP code not found — enter city/state manually')
        })
    },
    [token]
  )

  return { handleZipChange, status, message }
}
