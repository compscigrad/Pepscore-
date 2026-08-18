// @vitest-environment jsdom
//
// 2026-08-18 mobile-nav regression: PredictiveSearch's outside-click
// handling used to be wired (via its single onClose callback) to close a
// caller's entire surrounding menu, not just its own dropdown. A tap
// anywhere outside the search box -- including on a nav link elsewhere in
// the same mobile menu -- fired that handler on `mousedown`, unmounting
// the whole menu (the tapped link included) before the browser's
// subsequent `click` event could ever reach it. Every mobile nav item was
// effectively dead on first real tap.
//
// The critical detail these tests depend on: a plain `fireEvent.click()`
// only dispatches a synthetic `click` event and would NOT have caught this
// bug (that's exactly why it looked "not navigated" only when tested with
// a genuine tap, not a JS-dispatched .click() -- see the investigation
// this fix came out of). `@testing-library/user-event`'s click() fires the
// real pointerdown/mousedown/pointerup/mouseup/click sequence a physical
// tap produces, which is what actually exercises this failure mode.
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { PredictiveSearch } from './PredictiveSearch'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/analytics/track', () => ({ trackEvent: vi.fn() }))

const searchIndexResponse = {
  products: [
    { id: '1', name: 'Semaglutide', size: '5mg', slug: 'semaglutide-5mg', category: 'GLP-1 Agonist', imageUrl: '/x.png', aliases: [] },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ json: () => Promise.resolve(searchIndexResponse) } as Response))
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Mirrors exactly how Header.tsx wires the mobile menu: PredictiveSearch
// plus a sibling nav link, menu state closes via onSelect (a real
// selection/submit), not via PredictiveSearch's own onClose.
function MobileMenuHarness({ onNavClick }: { onNavClick: () => void }) {
  const [menuOpen, setMenuOpen] = useState(true)
  if (!menuOpen) return <div data-testid="menu-closed" />
  return (
    <div data-testid="menu">
      <PredictiveSearch onSelect={() => setMenuOpen(false)} />
      {/* Plain <a>, not next/link -- this harness only needs to prove real
          click-event timing (mousedown/click ordering) against a minimal
          DOM stand-in for Header.tsx's actual nav <Link>, not exercise
          real Next.js routing. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/#products"
        onClick={(e) => {
          e.preventDefault()
          onNavClick()
          setMenuOpen(false)
        }}
      >
        Products
      </a>
    </div>
  )
}

describe('PredictiveSearch outside-click / mobile-menu regression', () => {
  it('a real tap on a sibling nav link fires its own click -- an outside mousedown does not unmount the menu first', async () => {
    const user = userEvent.setup()
    const onNavClick = vi.fn()
    render(<MobileMenuHarness onNavClick={onNavClick} />)

    await user.click(screen.getByText('Products'))

    expect(onNavClick).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('menu-closed')).toBeInTheDocument()
  })

  it('onClose still fires on a genuine outside click (search-field-only collapse is preserved)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <div>
        <PredictiveSearch onClose={onClose} />
        <button>elsewhere</button>
      </div>
    )

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText('elsewhere'))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('selecting a result fires both onClose and onSelect', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(<PredictiveSearch onClose={onClose} onSelect={onSelect} />)

    await user.type(screen.getByRole('combobox'), 'Semaglutide')
    const option = await screen.findByText(/Semaglutide/)
    await user.click(option)

    expect(onClose).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
  })

  it('submitting the field (Enter) fires both onClose and onSelect', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(<PredictiveSearch onClose={onClose} onSelect={onSelect} />)

    await user.type(screen.getByRole('combobox'), 'somethingnotintheindex{Enter}')

    expect(onClose).toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
  })

  it('Escape closes the dropdown without triggering selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<PredictiveSearch onSelect={onSelect} />)

    const input = screen.getByRole('combobox')
    await user.type(input, 'Semaglutide')
    await screen.findByText(/Semaglutide/)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a loading state before the index resolves, then no-results for a non-matching query', async () => {
    const user = userEvent.setup()
    render(<PredictiveSearch />)

    await user.type(screen.getByRole('combobox'), 'zzz-no-match')

    await waitFor(() => expect(screen.getByText(/no matching products found/i)).toBeInTheDocument())
  })

  it('keyboard ArrowDown/ArrowUp moves the active option', async () => {
    const user = userEvent.setup()
    render(<PredictiveSearch />)

    const input = screen.getByRole('combobox')
    await user.type(input, 'Semaglutide')
    await screen.findByText(/Semaglutide/)

    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', 'predictive-search-option-0')
  })
})
