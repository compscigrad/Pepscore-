'use client'

// Shared dark-theme dropdown primitive (2026-08-18 contrast audit, round
// 2). A native <select>'s expanded option list is rendered by the
// browser/OS, not by the page's CSS -- `color-scheme: dark` (the global
// app/globals.css fix from round 1) is the standards-correct way to
// influence that, but real-world testing showed it doesn't reliably win
// on every browser/OS combination, and native option-list styling has
// always been notoriously inconsistent across engines. Rather than keep
// fighting native rendering for surfaces that matter, this is a fully
// custom, self-styled listbox -- background and text color are real CSS
// this component controls end to end, so there's no dependency on how
// any given browser chooses to render native form-control chrome.
// Matches the same visual language (dark surface, gold accent) already
// proven correct in components/storefront/PredictiveSearch.tsx and
// components/admin/AdminCustomerSearch.tsx's custom popovers.
//
// Keyboard handling follows the ARIA "collapsible listbox" pattern: focus
// stays on the trigger button the whole time (never moves to the popup),
// and the active option is communicated via aria-activedescendant --
// standard practice for this exact widget shape, and it also sidesteps
// having to manage focus transfer in/out of a dynamically mounted list.
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DarkListboxOption {
  value: string
  label: string
}

interface DarkListboxProps {
  value: string
  onChange: (value: string) => void
  options: DarkListboxOption[]
  ariaLabel?: string
  className?: string
}

export function DarkListbox({ value, onChange, options, ariaLabel, className = '' }: DarkListboxProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function selectIndex(index: number) {
    const opt = options[index]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectIndex(activeIndex)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-option-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (!open) setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)))
          setOpen((o) => !o)
        }}
        onKeyDown={handleTriggerKeyDown}
        className="w-full flex items-center justify-between gap-2 border border-white/15 bg-white/[0.04] rounded px-3 py-2 text-[13px] text-white text-left focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30 transition-colors"
      >
        <span className="truncate">{selected?.label ?? 'Select…'}</span>
        <ChevronDown size={14} className={`flex-shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-[#141414] border border-white/15 rounded-lg shadow-[0_16px_40px_rgba(0,0,0,0.5)] py-1"
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => {
                e.preventDefault()
                selectIndex(i)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-2 text-[13px] cursor-pointer truncate ${
                opt.value === value ? 'text-gold' : i === activeIndex ? 'bg-white/10 text-white' : 'text-white/80'
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
