// Reusable DNA/molecular background-art layer (2026-08-12 gold+science
// design pass). Wraps the owner-provided source asset
// (public/images/brand/dna-molecular-bg.png, copied verbatim from
// C:\Users\micha\Downloads\background.art.Pepscore.png -- never
// regenerated/redrawn) in a configurable, reusable treatment instead of
// hardcoding a background-image into every section that wants it.
//
// Purely decorative -- aria-hidden, no alt text, never announced by a
// screen reader. Positioned absolutely behind a section's real content,
// which must itself use `relative` (and ideally its own z-10) to stack
// above this.
import Image from 'next/image'

export type BackgroundIntensity = 'strong' | 'medium' | 'subtle'

const INTENSITY_OPACITY: Record<BackgroundIntensity, string> = {
  strong: 'opacity-[0.22]',
  medium: 'opacity-[0.10]',
  subtle: 'opacity-[0.05]',
}

interface ScientificBackgroundProps {
  intensity?: BackgroundIntensity
  // Tailwind object-position utility controlling which part of the source
  // image shows and where -- the asset's DNA helix sits on its right
  // side with clean negative space on the left, so the default keeps
  // that edge-aligned composition (helix near the page edge, not behind
  // text) per the standing design direction.
  position?: string
  // Fades the image into the section's own background at these edges so
  // it reads as bleeding into the page rather than a hard-edged photo.
  fadeLeft?: boolean
  fadeRight?: boolean
  fadeBottom?: boolean
  className?: string
}

export function ScientificBackground({
  intensity = 'medium',
  position = 'object-right',
  fadeLeft = true,
  fadeRight = false,
  fadeBottom = false,
  className = '',
}: ScientificBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <Image
        src="/images/brand/dna-molecular-bg.png"
        alt=""
        fill
        className={`${position} object-cover ${INTENSITY_OPACITY[intensity]}`}
        sizes="100vw"
        loading="lazy"
      />
      {/* Fade the art into the section's own black background at its
          edges so it never reads as a hard-edged inserted photo, and so
          text sitting near the left edge always has clear negative
          space behind it regardless of viewport width. */}
      {fadeLeft && <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black via-black/60 to-transparent" />}
      {fadeRight && <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-black via-black/60 to-transparent" />}
      {fadeBottom && <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />}
    </div>
  )
}
