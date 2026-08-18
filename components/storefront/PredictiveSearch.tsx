'use client'

// Shared desktop + mobile predictive search combobox, used identically by
// both of Header.tsx's search entry points so there's exactly one
// autocomplete implementation rather than two subtly different ones. Loads
// the lightweight /api/storefront/search-index catalog once (lazily, on
// first interaction) and ranks every keystroke locally against it via the
// existing, unit-tested lib/storefront/searchRank.ts -- the same tiered
// exact/alias/normalized/token/fuzzy matcher the full /search results page
// uses, so a query never resolves differently between the dropdown and the
// full-page results it can still fall through to. No per-keystroke network
// request, no debounce needed -- filtering ~100 already-loaded rows is
// effectively instant.
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { rankSearch, type SearchableProduct } from '@/lib/storefront/searchRank'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

interface SearchIndexItem extends SearchableProduct {
  slug: string
  imageUrl: string
}

const MAX_RESULTS = 8

// Module-level cache (not component state) -- the catalog is identical
// across every mount of this component (desktop instance, mobile
// instance, or a remount after navigation), so one fetch serves the whole
// session instead of once per instance.
let indexPromise: Promise<SearchIndexItem[]> | null = null
function loadSearchIndex(): Promise<SearchIndexItem[]> {
  if (!indexPromise) {
    indexPromise = fetch('/api/storefront/search-index')
      .then((res) => res.json())
      .then((data) => (data.products ?? []) as SearchIndexItem[])
      .catch(() => {
        indexPromise = null
        return []
      })
  }
  return indexPromise
}

// rankSearch's own tier order (exact name -> exact alias -> normalized ->
// token -> fuzzy) is preserved untouched -- this only adds a stable
// secondary sort so a name literally beginning with the typed string
// surfaces above a name that merely contains it somewhere, within
// whichever tier rankSearch already placed each result in. Array.sort is
// stable (ES2019+), so ties keep rankSearch's original relative order.
function orderForDropdown(query: string, products: SearchIndexItem[]): SearchIndexItem[] {
  const ranked = rankSearch(query, products).map((r) => r.product)
  const q = query.trim().toLowerCase()
  return [...ranked].sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    return aStarts - bStarts
  })
}

interface PredictiveSearchProps {
  className?: string
  inputClassName?: string
  placeholder?: string
  autoFocus?: boolean
  // Fired when the search field itself collapses empty -- on blur or a
  // click/tap outside this component's own containerRef. Desktop uses this
  // to hide the field back to just the icon. 2026-08-18 mobile-nav fix:
  // this must NOT be wired to closing a caller's larger surrounding menu
  // (see onSelect below) -- a tap on any element outside this narrow
  // search box, including a nav link elsewhere in the same mobile menu,
  // fires this via `mousedown`, which used to unmount the whole menu
  // (including the tapped link) before the link's own `click` event could
  // fire, making every mobile nav item dead on first real tap.
  onClose?: () => void
  // Fired specifically when the user completes a search action -- picks a
  // result (goToProduct) or submits the field (submitFullSearch). Unlike
  // onClose, this never fires from an incidental outside click, so it's
  // safe for a caller to wire this to closing a larger surrounding menu
  // (Header.tsx's mobile hamburger) without that menu swallowing clicks on
  // its own other contents.
  onSelect?: () => void
  // Optional decorative/interactive chrome (2026-08-17 homepage-search
  // parity fix) -- rendered as siblings of the input inside this
  // component's own <form>, so a caller-styled search icon or submit
  // button (e.g. HomeSearchBar's pill button) keeps working via native
  // form submission instead of every caller reimplementing its own
  // predictive dropdown. Both undefined by default -- Header.tsx's two
  // existing call sites are unaffected.
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
}

export function PredictiveSearch({ className = '', inputClassName = '', placeholder = 'Search products…', autoFocus, onClose, onSelect, leftSlot, rightSlot }: PredictiveSearchProps) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [index, setIndex] = useState<SearchIndexItem[] | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  function ensureIndexLoaded() {
    if (index === null) loadSearchIndex().then(setIndex)
  }

  const trimmed = value.trim()
  const results = trimmed && index ? orderForDropdown(trimmed, index).slice(0, MAX_RESULTS) : []

  // Reset the highlighted option whenever the query changes -- adjusted
  // during render (React's documented pattern for this exact case) rather
  // than in an effect, which would cause an extra cascading render.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setActiveIndex(-1)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current || containerRef.current.contains(e.target as Node)) return
      setOpen(false)
      if (!value.trim()) onClose?.()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function goToProduct(item: SearchIndexItem) {
    trackEvent(AnalyticsEvent.SEARCH, { queryLength: trimmed.length })
    router.push(`/products/${item.slug}`)
    setValue('')
    setOpen(false)
    onClose?.()
    onSelect?.()
  }

  function submitFullSearch() {
    if (!trimmed) return
    trackEvent(AnalyticsEvent.SEARCH, { queryLength: trimmed.length })
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    setOpen(false)
    onClose?.()
    onSelect?.()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      if (results.length === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      if (results.length === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      e.currentTarget.blur()
    }
    // Enter is handled by the form's onSubmit below, not here, so it
    // behaves the same whether triggered by keyboard or (in principle) a
    // submit button -- no duplicate logic between the two paths.
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (activeIndex >= 0 && results[activeIndex]) goToProduct(results[activeIndex])
          else submitFullSearch()
        }}
      >
        {leftSlot}
        <input
          type="search"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
            ensureIndexLoaded()
          }}
          onFocus={() => {
            setOpen(true)
            ensureIndexLoaded()
          }}
          onBlur={() => {
            // Timeout, not an immediate close: a click on a result button
            // fires this blur first, and closing synchronously here would
            // unmount the option before its own onMouseDown/click handler
            // runs. Long enough to survive that reflow, short enough that
            // a genuine tab-away still closes promptly.
            setTimeout(() => {
              setOpen(false)
              if (!value.trim()) onClose?.()
            }, 120)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search products"
          role="combobox"
          aria-expanded={open && (results.length > 0 || trimmed.length > 0)}
          aria-controls="predictive-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `predictive-search-option-${activeIndex}` : undefined}
          autoComplete="off"
          className={inputClassName}
        />
        {rightSlot}
      </form>

      {open && trimmed.length > 0 && (
        <div
          id="predictive-search-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-[960] w-[min(320px,90vw)] max-h-[min(420px,70vh)] overflow-y-auto bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-[#D4AF37]/30 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          {results.length > 0 ? (
            results.map((item, i) => (
              <button
                key={item.id}
                id={`predictive-search-option-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => goToProduct(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${
                  i === activeIndex ? 'bg-[#D4AF37]/10' : 'hover:bg-white/5'
                }`}
              >
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-md object-cover flex-shrink-0 bg-white/5"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-heading font-bold text-white truncate">
                    {item.name} <span className="text-white/50 font-normal">{item.size}</span>
                  </span>
                  <span className="block text-[11px] text-white/40 truncate">{item.category}</span>
                </span>
              </button>
            ))
          ) : index === null ? (
            <p className="px-3.5 py-3 text-[13px] text-white/50">Searching…</p>
          ) : (
            <p className="px-3.5 py-3 text-[13px] text-white/50">No matching products found.</p>
          )}
        </div>
      )}
    </div>
  )
}
