'use client'

// Admin-only predictive customer lookup (2026-08-17) -- fast "jump to a
// known customer" workflow, deliberately separate from the existing
// filter form on app/admin/customers/page.tsx (URL-param-driven,
// list/browse/filter workflow). The two coexist: this is for "I know who
// I'm looking for", the filter form is for "show me customers matching
// these criteria."
//
// Unlike components/storefront/PredictiveSearch.tsx, this can NOT
// preload-then-filter-client-side -- customer PII must never be fetched
// in bulk to the browser. Every keystroke (debounced) hits the
// admin-gated /api/admin/customers/search route instead, matching the
// same keyboard-nav/open-close/loading/no-results UX conventions as the
// storefront combobox for consistency, not by sharing its component (the
// data shape and navigation target are both different).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerResult {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  hasPortalAccess: boolean
}

const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 2

export function AdminCustomerSearch({ className = '', placeholder = 'Search customers by name, email, or phone…' }: { className?: string; placeholder?: string }) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [results, setResults] = useState<CustomerResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  const trimmed = value.trim()

  // Reset the highlighted option and (below the minimum query length)
  // clear stale results synchronously as the query changes -- adjusted
  // during render (React's documented pattern for this exact case, same
  // one components/storefront/PredictiveSearch.tsx uses) rather than in
  // an effect, which would cause an extra cascading render. The effect
  // below is left to do only its one real job: the async fetch.
  const [prevTrimmed, setPrevTrimmed] = useState(trimmed)
  if (trimmed !== prevTrimmed) {
    setPrevTrimmed(trimmed)
    setActiveIndex(-1)
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (trimmed.length < MIN_QUERY_LENGTH) return
    const thisRequestId = ++requestIdRef.current
    debounceRef.current = setTimeout(() => {
      // Loading only flips on once the debounce actually elapses and the
      // request fires -- not synchronously in the effect body (React
      // flags/discourages that), and it avoids a flicker for keystrokes
      // that get superseded before the debounce fires anyway.
      setLoading(true)
      fetch(`/api/admin/customers/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => res.json())
        .then((data) => {
          // Stale-response guard -- a slower earlier request resolving
          // after a faster later one must never overwrite it.
          if (thisRequestId !== requestIdRef.current) return
          setResults(data.customers ?? [])
        })
        .catch(() => {
          if (thisRequestId !== requestIdRef.current) return
          setResults([])
        })
        .finally(() => {
          if (thisRequestId !== requestIdRef.current) return
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [trimmed])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current || containerRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function goToCustomer(customer: CustomerResult) {
    router.push(`/admin/customers/${customer.id}`)
    setValue('')
    setResults(null)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = results ?? []
    if (e.key === 'ArrowDown') {
      if (list.length === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % list.length)
    } else if (e.key === 'ArrowUp') {
      if (list.length === 0) return
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? list.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && list[activeIndex]) goToCustomer(list[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      e.currentTarget.blur()
    }
  }

  const showDropdown = open && trimmed.length >= MIN_QUERY_LENGTH

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search customers"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="admin-customer-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `admin-customer-search-option-${activeIndex}` : undefined}
        autoComplete="off"
        className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/60 transition-colors"
      />

      {showDropdown && (
        <div
          id="admin-customer-search-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-[200] max-h-[min(420px,70vh)] overflow-y-auto bg-[#141414] border border-white/15 rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          {loading ? (
            <p className="px-4 py-3 text-[13px] text-white/50">Searching…</p>
          ) : results && results.length > 0 ? (
            results.map((customer, i) => (
              <button
                key={customer.id}
                id={`admin-customer-search-option-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => goToCustomer(customer)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  i === activeIndex ? 'bg-[#D4AF37]/10' : 'hover:bg-white/5'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white truncate">
                    {customer.name || 'Unnamed customer'}
                    {customer.company && <span className="text-white/40 font-normal"> · {customer.company}</span>}
                  </span>
                  <span className="block text-[11px] text-white/40 truncate">
                    {[customer.email, customer.phone].filter(Boolean).join(' · ') || 'No contact info on file'}
                  </span>
                </span>
                {customer.hasPortalAccess && (
                  <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    Portal
                  </span>
                )}
              </button>
            ))
          ) : results && results.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-white/50">No matching customers found.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
