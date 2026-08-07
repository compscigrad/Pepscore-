// Dark Pepscore storefront theme (Phase 2B correction) -- the live
// pepscorelab.com landing page (pepscore-landing repo, components/landing/
// LandingHero.tsx and LandingHeader.tsx, read directly from source, not
// assumed) is the customer-facing visual source of truth: black background,
// gold gradient accents, white text at varying opacity, rounded-full pill
// buttons/badges, low-opacity gold borders. This replaces the old
// light/cream storefront theme (bg-cream/bg-white/text-dark) that predates
// this redesign -- that old theme is now used ONLY on internal admin pages
// (e.g. components/admin/InventoryDetailPanel.tsx), never customer-facing.
//
// The landing repo implements this via inline style objects; this app is
// Tailwind-class-based everywhere else, so these are arbitrary-value
// Tailwind classes carrying the same real hex/rgba values from that
// source, not a re-guess -- mirrors the existing
// components/invoices/theme.ts token-module convention for the admin side.
export const pageBg = 'bg-black'
export const cardBg = 'bg-[#0d0d0d] border border-[#D4AF37]/15'
export const cardBgHover = 'hover:border-[#D4AF37]/40 hover:-translate-y-1 transition-all duration-300'
export const surfaceBg = 'bg-[#111111] border border-[#D4AF37]/15'

export const textPrimary = 'text-white'
export const textSecondary = 'text-white/65'
export const textMuted = 'text-white/45'
export const textFaint = 'text-white/35'

export const goldText = 'text-[#D4AF37]'
export const goldGradientText = 'bg-gradient-to-br from-[#D4AF37] via-[#E8C84A] to-[#D4AF37] bg-clip-text text-transparent'
export const goldGradientBg = 'bg-gradient-to-br from-[#D4AF37] to-[#E8C84A]'

export const borderGold = 'border-[#D4AF37]/15'
export const borderGoldStrong = 'border-[#D4AF37]/35'

export const pillPrimary =
  'inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[13px] font-bold tracking-[0.07em] uppercase px-8 py-3.5 rounded-full transition-all hover:shadow-[0_10px_32px_rgba(212,175,55,0.45)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none'

export const pillOutline =
  'inline-flex items-center justify-center gap-2 border border-[#D4AF37]/45 bg-[#D4AF37]/7 backdrop-blur text-white/90 font-heading text-[13px] font-bold tracking-[0.07em] uppercase px-8 py-3.5 rounded-full transition-all hover:bg-[#D4AF37]/15'

export const badge = 'inline-flex items-center gap-1.5 bg-[#D4AF37]/10 border border-[#D4AF37]/35 text-[#D4AF37] rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-[0.06em] backdrop-blur'

export const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'

export const sectionEyebrow = 'font-heading text-[11px] font-bold tracking-[0.28em] uppercase text-[#D4AF37]/70'
