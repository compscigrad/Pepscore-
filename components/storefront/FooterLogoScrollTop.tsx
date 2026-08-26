'use client'

// Makes the footer's large closing brand mark act as a "back to top"
// control for the CURRENT page -- deliberately not a Link to "/" (unlike
// the navbar logo, see Header.tsx's handleLogoClick): a visitor reading the
// footer of a product detail or policy page almost certainly wants to
// scroll back up that same page, not be navigated away to the homepage.
import { BrandLockup } from './BrandLockup'

export function FooterLogoScrollTop() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll back to top of page"
      className="cursor-pointer rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
    >
      <BrandLockup size="footerLarge" />
    </button>
  )
}
