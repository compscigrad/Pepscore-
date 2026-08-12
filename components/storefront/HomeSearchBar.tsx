// Homepage-embedded product search -- sits between the catalog directory
// and the prioritized product grid (docs/ProductRoadmap.md homepage
// sprint hierarchy: Hero -> Catalog Directory -> Search -> Products).
// Submits to the same /search route the header's search icon already
// uses -- one search implementation, not a second one.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

export function HomeSearchBar() {
  const router = useRouter()
  const [value, setValue] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (!q) return
    trackEvent(AnalyticsEvent.SEARCH, { queryLength: q.length })
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <section className="bg-black py-10 px-6">
      <div className="max-w-[640px] mx-auto">
        <form onSubmit={submit} className="relative">
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37]/60 pointer-events-none" />
          <input
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search the research catalog — compound name or strength…"
            aria-label="Search products"
            className="w-full border border-[#D4AF37]/25 bg-white/[0.03] rounded-full pl-13 pr-28 py-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
            style={{ paddingLeft: '3.25rem' }}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[11px] font-bold tracking-[0.06em] uppercase px-5 py-2.5 rounded-full hover:-translate-y-1/2 hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] transition-shadow"
          >
            Search
          </button>
        </form>
      </div>
    </section>
  )
}
