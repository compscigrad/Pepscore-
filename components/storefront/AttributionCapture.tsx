'use client'

import { useEffect } from 'react'
import { captureAttributionOnce } from '@/lib/storefront/attribution'

// Mounted once in the root layout — renders nothing, just captures
// first-touch attribution (referrer/UTM/landing URL) on the visitor's
// first page view. See lib/storefront/attribution.ts.
export function AttributionCapture() {
  useEffect(() => {
    captureAttributionOnce()
  }, [])
  return null
}
