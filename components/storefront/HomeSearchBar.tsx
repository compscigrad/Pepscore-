// Homepage-embedded product search -- sits between the catalog directory
// and the prioritized product grid (docs/ProductRoadmap.md homepage
// sprint hierarchy: Hero -> Catalog Directory -> Search -> Products).
// Predictive (2026-08-17 search-standard sprint) -- reuses the exact same
// PredictiveSearch component/index/rankSearch the navbar search already
// uses (via leftSlot/rightSlot so this bar's own icon+button chrome is
// preserved), rather than a second, plain submit-only implementation. Enter
// with no dropdown selection still falls through to the same /search route
// the header's search icon uses -- one search implementation, not two.
'use client'

import { Search } from 'lucide-react'
import { PredictiveSearch } from './PredictiveSearch'

export function HomeSearchBar() {
  return (
    <section className="bg-black py-10 px-6">
      <div className="max-w-[640px] mx-auto">
        <PredictiveSearch
          className="relative w-full"
          placeholder="Search the research catalog — compound name or strength…"
          inputClassName="w-full border border-[#D4AF37]/25 bg-white/[0.03] rounded-full pl-[3.25rem] pr-28 py-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
          leftSlot={<Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D4AF37]/60 pointer-events-none" />}
          rightSlot={
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[11px] font-bold tracking-[0.06em] uppercase px-5 py-2.5 rounded-full hover:-translate-y-1/2 hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] transition-shadow"
            >
              Search
            </button>
          }
        />
      </div>
    </section>
  )
}
