// Shared Tailwind class tokens for the invoice dashboard/builder's dark
// theme. Centralized so the "glass card on black" look (bg-white/[0.03] +
// hairline gold border, no shadow) — measured live from
// pepscore-landing.vercel.app, not guessed — lives in one place instead of
// being re-typed per component. Deliberately excludes InvoicePreview.tsx,
// which stays a literal white card representing the PDF page.
export const card = 'bg-white/[0.03] border border-gold/10 rounded-[18px]'

export const input =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/30'

// Native <option> popups are OS-rendered widgets, not page content — on
// Windows Chrome/Edge in particular, the popup largely ignores
// background-color set on <option> (confirmed: getComputedStyle reported
// our dark background correctly, but it never actually painted), while
// `color` mostly *is* honored. Fighting the native background is
// unreliable across browsers/OSes, so instead of a dark popup with white
// text, this targets whatever light background the browser actually
// renders: dark text guarantees contrast regardless of which browser
// honors which property. `bg-white` is set too as a best-effort match for
// browsers that do respect it, but `text-dark` is what's actually load-bearing.
export const selectOption = 'bg-white text-dark'

export const label = 'block text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-1.5'

export const sectionHeading = 'font-heading text-[15px] font-bold text-white'

export const divider = 'border-white/10'

export const mutedText = 'text-white/50'

export const pillPrimary =
  'rounded-full bg-gold text-white text-sm font-bold hover:bg-gold-dark transition-colors disabled:opacity-50'

export const pillSecondary =
  'rounded-full bg-white/10 text-white text-sm font-bold hover:bg-white/15 transition-colors'

export const pillOutline =
  'rounded-full border border-white/15 text-white/70 text-sm font-bold hover:bg-white/5 transition-colors disabled:opacity-50'
