// Reusable PEPSCORE / LAB brand lockup (2026-08-13) -- extracted from the
// navbar implementation (components/storefront/Header.tsx) so the footer's
// dramatically larger closing brand mark reuses the exact same P asset,
// typography, gold-rule construction, and layout logic instead of a second,
// drifting copy. `size="navbar"` reproduces the original navbar treatment
// pixel-for-pixel; `size="footerLarge"` scales every piece up for a hero-
// scale footer signature. The LAB row's two rule lines are flex-1 children
// of a flex-col wrapper with no explicit width, so they always stretch to
// meet PEPSCORE's own rendered width -- true at both scales, no manual math.
//
// footerLarge centering (2026-08-14 fix): the footer previously centered
// the P+wordmark pair as one flex row, which visually shifted the wordmark
// right of true center -- centering a [P][gap][wordmark] box means the
// wordmark's own midpoint sits (P width + gap)/2 to the right of the box's
// midpoint, not at it. The wordmark must be the thing that gets centered;
// the P is now position:absolute, anchored to sit immediately left of the
// wordmark via right-full, which removes it from the in-flow box entirely
// so it never contributes to the centered element's measured width.
import Image from 'next/image'

export type BrandLockupSize = 'navbar' | 'footerLarge'

interface BrandLockupProps {
  size?: BrandLockupSize
  className?: string
}

const SIZE_STYLES: Record<BrandLockupSize, {
  iconPx: number
  iconClass: string
  gapClass: string
  iconOffsetClass: string
  pepscoreClass: string
  tmClass: string
  tmPositionClass: string
  labClass: string
  labRowGapClass: string
  labRowMarginClass: string
}> = {
  navbar: {
    iconPx: 40,
    iconClass: 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10',
    gapClass: 'gap-2 sm:gap-2.5',
    // Unused in navbar mode (P stays in normal flex flow) -- kept so both
    // variants share one config shape.
    iconOffsetClass: '',
    pepscoreClass: 'text-[13px] sm:text-[15px] md:text-[17px]',
    tmClass: 'text-[6px] sm:text-[7px] md:text-[8px]',
    // top-[10%] (a percentage, not em/px) -- see footerLarge's own comment
    // below for why this specific value and why it's shared unchanged
    // across both variants.
    tmPositionClass: 'top-[10%] -right-1.5',
    labClass: 'text-[8px] sm:text-[9px] md:text-[10px]',
    labRowGapClass: 'gap-1.5',
    labRowMarginClass: 'mt-1',
  },
  footerLarge: {
    iconPx: 128,
    iconClass: 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28',
    gapClass: 'gap-4 sm:gap-5 lg:gap-6',
    iconOffsetClass: 'mr-4 sm:mr-5 lg:mr-6',
    pepscoreClass: 'text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px]',
    tmClass: 'text-[11px] sm:text-[13px] md:text-[15px] lg:text-[17px]',
    // top-[10%] (2026-08-14, tuned by measurement): with the wrapper below
    // now sized exactly to PEPSCORE's own box (no strut ambiguity), `top`
    // is a clean percentage of that real box height, so 10% lands the
    // mark at the same cap-height-relative position regardless of scale --
    // derived directly from this variant's own previously-approved
    // placement (measured at ~10% of PEPSCORE's box height before this
    // fix touched the wrapper's box model), then applied identically to
    // navbar above so the two now match by construction, not coincidence.
    tmPositionClass: 'top-[10%] -right-3 sm:-right-3.5 lg:-right-4',
    labClass: 'text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px]',
    labRowGapClass: 'gap-3 sm:gap-4',
    labRowMarginClass: 'mt-2 sm:mt-2.5',
  },
}

export function BrandLockup({ size = 'navbar', className = '' }: BrandLockupProps) {
  const s = SIZE_STYLES[size]

  const icon = (
    <Image
      src="/images/email-logo-mark.png"
      alt=""
      width={s.iconPx}
      height={s.iconPx}
      className={`${s.iconClass} flex-shrink-0`}
      priority={size === 'navbar'}
    />
  )

  // The wordmark's own box is what gets centered (footerLarge) or laid out
  // in-flow next to the P (navbar) -- either way its internal structure is
  // identical. relative + inline-flex on the PEPSCORE line so the TM mark
  // can be position:absolute against it without adding to PEPSCORE's own
  // measured width (never shifts LAB's rule-stretch or the column's
  // centering) and without inheriting the line's baseline/ascent quirks.
  const wordmark = (
    <span className="flex flex-col">
      {/* inline-flex, not inline-block (2026-08-14 fix, found by measuring
          the real DOM, not assumed): an inline-block wrapper generates its
          own "strut" line-box sized by ITS OWN inherited font-size/
          line-height, independent of its PEPSCORE child's actual size --
          that phantom box, not PEPSCORE's real box, is what `top` on the
          sup was actually offset from, so the same top value produced a
          different visual result depending on ambient font-size context.
          inline-flex sizes strictly to its one in-flow child (the sup is
          absolute, excluded from flex layout either way) with no strut. */}
      <span className="relative inline-flex">
        <span className={`font-heading ${s.pepscoreClass} font-extrabold tracking-[0.08em] leading-none text-white whitespace-nowrap`}>
          PEPSCORE
        </span>
        <sup className={`absolute ${s.tmPositionClass} ${s.tmClass} font-bold text-white/70 leading-none`}>™</sup>
      </span>
      <span className={`flex items-center ${s.labRowGapClass} ${s.labRowMarginClass}`}>
        <span className="h-px flex-1 bg-[#D4AF37]" />
        <span
          className={`font-heading ${s.labClass} font-bold tracking-[0.35em] leading-none whitespace-nowrap bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] bg-clip-text text-transparent`}
        >
          LAB
        </span>
        <span className="h-px flex-1 bg-[#D4AF37]" />
      </span>
    </span>
  )

  if (size === 'navbar') {
    // Unchanged from the original navbar implementation -- P and wordmark
    // in one normal flex row, left-aligned in the nav, no independent
    // centering needed here.
    return (
      <span className={`flex items-center ${s.gapClass} ${className}`}>
        {icon}
        {wordmark}
      </span>
    )
  }

  // footerLarge: this outer span is what the footer's own `items-center`
  // column centers. It's sized to the wordmark alone -- the P is
  // position:absolute (right-full anchors its right edge to this span's
  // left edge, i.e. immediately outside/left of it), so it's excluded from
  // this element's in-flow box and never pulls the measured center right.
  return (
    <span className={`relative inline-block ${className}`}>
      {/* s.iconClass repeated here (not just on the <Image> inside) --
          without an explicit size, this absolutely-positioned wrapper's
          own default-inline box computed to zero width in testing (a
          `right`-only absolute box's shrink-to-fit didn't reliably pick up
          its content's size), silently collapsing the P to invisible. */}
      <span className={`absolute top-1/2 -translate-y-1/2 right-full ${s.iconOffsetClass} ${s.iconClass}`}>
        {icon}
      </span>
      {wordmark}
    </span>
  )
}
