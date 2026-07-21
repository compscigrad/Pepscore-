// Shared ZIP-code auto-fill behavior for CustomerInfoSection (billing) and
// ShippingSection (shipping) — one hook so both address blocks trigger,
// debounce, and report lookup status identically.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ZipLookupStatus = 'idle' | 'loading' | 'error'

export interface ZipLookupResult {
  city: string
  state: string
}

// `onFound` is read via a ref, not closed over directly — the lookup is
// async and the field it updates typically re-renders (and re-creates
// callbacks) before the network response arrives, so a plain closure would
// risk writing back a stale snapshot of the surrounding form state (e.g.
// clobbering a ZIP digit typed after the lookup was kicked off). The ref
// always points at whatever `onFound` was passed on the most recent render.
export function useZipLookup(onFound: (result: ZipLookupResult) => void) {
  const [status, setStatus] = useState<ZipLookupStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const onFoundRef = useRef(onFound)
  useEffect(() => {
    onFoundRef.current = onFound
  })
  // Prevents re-fetching the same 5 digits again on every keystroke of a
  // ZIP+4 suffix, while still re-triggering if the base ZIP actually changes.
  const lastLookedUpRef = useRef<string | null>(null)

  const handleZipChange = useCallback((zip: string) => {
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

    fetch(`/api/admin/zip-lookup?zip=${zip5}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'ZIP code not found')
        onFoundRef.current({ city: data.city, state: data.state })
        setStatus('idle')
        setMessage(null)
      })
      .catch((err: unknown) => {
        // Deliberately never clears city/state/street on failure — the user
        // may have already filled those in by hand, or will next.
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'ZIP code not found — enter city/state manually')
      })
  }, [])

  return { handleZipChange, status, message }
}
