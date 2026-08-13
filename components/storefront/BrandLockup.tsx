// Reusable PEPSCORE / LAB brand lockup (2026-08-13) -- extracted from the
// navbar implementation (components/storefront/Header.tsx) so the footer's
// dramatically larger closing brand mark reuses the exact same P asset,
// typography, gold-rule construction, and layout logic instead of a second,
// drifting copy. `size="navbar"` reproduces the original navbar treatment
// pixel-for-pixel; `size="footerLarge"` scales every piece up for a hero-
// scale footer signature. The LAB row's two rule lines are flex-1 children
// of a flex-col wrapper with no explicit width, so they always stretch to
// meet PEPSCORE's own rendered width -- true at both scales, no manual math.
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
  pepscoreClass: string
  labClass: string
  labRowGapClass: string
  labRowMarginClass: string
}> = {
  navbar: {
    iconPx: 40,
    iconClass: 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10',
    gapClass: 'gap-2 sm:gap-2.5',
    pepscoreClass: 'text-[13px] sm:text-[15px] md:text-[17px]',
    labClass: 'text-[8px] sm:text-[9px] md:text-[10px]',
    labRowGapClass: 'gap-1.5',
    labRowMarginClass: 'mt-1',
  },
  footerLarge: {
    iconPx: 128,
    iconClass: 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28',
    gapClass: 'gap-4 sm:gap-5 lg:gap-6',
    pepscoreClass: 'text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px]',
    labClass: 'text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px]',
    labRowGapClass: 'gap-3 sm:gap-4',
    labRowMarginClass: 'mt-2 sm:mt-2.5',
  },
}

export function BrandLockup({ size = 'navbar', className = '' }: BrandLockupProps) {
  const s = SIZE_STYLES[size]
  return (
    <span className={`flex items-center ${s.gapClass} ${className}`}>
      <Image
        src="/images/email-logo-mark.png"
        alt=""
        width={s.iconPx}
        height={s.iconPx}
        className={`${s.iconClass} flex-shrink-0`}
        priority={size === 'navbar'}
      />
      <span className="flex flex-col">
        <span className={`font-heading ${s.pepscoreClass} font-extrabold tracking-[0.08em] leading-none text-white whitespace-nowrap`}>
          PEPSCORE
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
    </span>
  )
}
