'use client'

// Sticky Admin nav hotfix (2026-08-19). Root cause: AdminNav's horizontal-
// scroll row (`overflow-x-auto`, needed so the full nav fits on narrow
// screens) forces the browser to also compute overflow-y as `auto` per the
// CSS spec -- you cannot have overflow-x:auto and overflow-y:visible on the
// same box; the "visible" axis silently computes to `auto` too. Every
// dropdown panel nested inside that row (AdminNav's own group menus,
// NotificationBell's panel) was an `absolute`-positioned descendant of that
// row, so it was clipped to the row's fixed 52px height by its own
// scrollable ancestor: present in the DOM, `visibility: visible`, but
// almost entirely outside the ancestor's clipped/hit-testable viewport --
// which looks exactly like "the button is there but clicking does nothing,"
// since the actual link targets were unreachable by pointer.
//
// Fix: portal the panel to document.body and position it with `fixed`
// coordinates computed from the trigger's real bounding rect, so it's no
// longer a DOM descendant of the overflow-clipped row at all.
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface AnchoredDropdownProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  align?: 'left' | 'right'
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: ReactNode
}

export function AnchoredDropdown({ open, anchorRef, align = 'left', onMouseEnter, onMouseLeave, children }: AnchoredDropdownProps) {
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null)

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setCoords(null)
      return
    }
    const update = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setCoords(
        align === 'right'
          ? { top: rect.bottom, right: window.innerWidth - rect.right }
          : { top: rect.bottom, left: rect.left }
      )
    }
    update()
    // Passive listeners, capture:true on scroll so this also catches the
    // nav's own inner horizontal-scroll row scrolling, not just the window.
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, align])

  if (!open || !coords || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed z-[200]"
      style={{ top: coords.top, left: coords.left, right: coords.right }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body
  )
}
