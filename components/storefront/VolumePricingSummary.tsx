// Surfaces the canonical standard-customer volume-discount ladder clearly
// (2026-08-19 Professional Access Closure Pass, section 1) -- the pricing
// engine already calculates the correct amount at checkout; this makes it
// visible before that point instead of only appearing as a line-item note
// on Stripe's own payment page. Never rendered for a Professional-eligible
// visitor (proEligible === true) -- Professional pricing supersedes the
// ladder entirely, so ladder messaging would be actively misleading there.
'use client'

import { computeVolumePricingPreview } from '@/lib/storefront/volumePricingPreview'
import type { CartItem } from '@/types'

interface Props {
  items: Pick<CartItem, 'sellUnit' | 'quantity' | 'price'>[]
  proEligible: boolean | null
  // 'compact' for the cart sidebar (one line), 'full' for the checkout
  // order summary (the explicit Standard subtotal / Volume discount /
  // Final subtotal breakdown).
  variant?: 'compact' | 'full'
}

export function VolumePricingSummary({ items, proEligible, variant = 'full' }: Props) {
  // Professional accounts never see standard-tier messaging -- and status
  // still loading (null) fails safe to "don't show" rather than flashing
  // ladder copy that might immediately need to disappear.
  if (proEligible !== false) return null

  const preview = computeVolumePricingPreview(items)
  if (preview.qualifyingCases === 0) return null

  const hasDiscount = preview.discountRate > 0
  const nextTierMessage = preview.nextTier
    ? `Add ${preview.nextTier.casesNeeded} more qualifying case${preview.nextTier.casesNeeded === 1 ? '' : 's'} to unlock ${Math.round(preview.nextTier.rate * 100)}% volume savings.`
    : null

  if (variant === 'compact') {
    if (!hasDiscount && !nextTierMessage) return null
    return (
      <p className="text-[11px] text-[#D4AF37] leading-relaxed">
        {hasDiscount
          ? `${Math.round(preview.discountRate * 100)}% volume savings applied (−$${preview.discountAmount.toFixed(2)}).`
          : nextTierMessage}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {hasDiscount && (
        <>
          <div className="flex justify-between text-[13px] text-white/50">
            <span>Standard subtotal</span>
            <span>${preview.standardSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-[#D4AF37]">
            <span>Volume discount ({Math.round(preview.discountRate * 100)}%)</span>
            <span>−${preview.discountAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-white/70 font-semibold">
            <span>Final subtotal</span>
            <span>${preview.finalSubtotal.toFixed(2)}</span>
          </div>
        </>
      )}
      {nextTierMessage && <p className="text-[11px] text-white/45 leading-relaxed">{nextTierMessage}</p>}
    </div>
  )
}
