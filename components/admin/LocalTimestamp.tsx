// Renders a moment-in-time in the viewer's own local timezone. Client-only
// on purpose: a Server Component's toLocaleString() runs on Vercel's
// server (UTC) instead of the admin's actual timezone, which silently
// disagreed with every other client-rendered timestamp on the customer
// page (CorrespondenceHistory, AccessHistorySection) by a fixed multi-hour
// offset for the exact same moment — found during the Auth Sprint's
// test-matrix pass. This is the one shared formatter every admin-facing
// timestamp should use so they can never drift apart again.
'use client'

export function LocalTimestamp({ value }: { value: string | Date }) {
  return <>{new Date(value).toLocaleString()}</>
}
