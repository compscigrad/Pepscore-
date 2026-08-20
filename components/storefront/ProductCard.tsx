'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'
import { BackorderIndicator } from './BackorderIndicator'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'
import { isPurchasable, AVAILABILITY_LABEL, AVAILABILITY_BADGE_CLASS, type StorefrontAvailability } from '@/lib/storefront/availability'
import { categoriesForProductName } from '@/lib/storefront/merchandisingTaxonomy'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

// Any imageUrl pointing at this path triggers the dynamic SVG vial renderer.
const GENERIC_PLACEHOLDER = '/images/products/default-single-vial.png'

export interface ProductVariant {
  id: string
  slug: string
  size: string
  // null when the product has no approved active pricing yet -- never a
  // formula-suggested/guessed number. See lib/storefront/pricing.ts.
  standardCasePrice: number | null
  unitsPerCase: number | null
  // Only ever set when individualSalesEnabled is true for this product --
  // a stored individual price with sales disabled (e.g. Tesamorelin) must
  // never reach this component at all.
  individualVialPrice: number | null
  // Only ever set when the current visitor is an admin-granted SPA-eligible
  // customer (lib/storefront/professionalAccess.ts) -- never shown to a public
  // or standard-eligibility visitor regardless of what's stored.
  proCasePrice: number | null
  // Real inventory-derived state, never the exact physical count. Split by
  // sell unit (2026-08-15) -- Standard Case and Single Vial are independent
  // physical-stock pools (e.g. Semaglutide 30mg: vial Ready to Ship, case
  // Produced to Order), so there is no longer one availability value per
  // variant. See lib/storefront/availability.ts.
  caseAvailability: StorefrontAvailability
  individualVialAvailability: StorefrontAvailability
  // Admin-editable text (Phase 2B item 6) shown instead of the generic
  // AVAILABILITY_LABEL when set -- never changes the underlying
  // availability/purchasability itself.
  availabilityMessageOverride: string | null
}

// Light Champagne (2026-08-15, final selection) -- picked over the
// original Champagne Bronze and the Cool/Pearl candidates from the
// comparison preview specifically for the extra luminance gap it gives the
// deep-gold (#C99A20) small text below; still warm/metallic/dimensional,
// not washed toward silver or gold itself.
const CHAMPAGNE_BRONZE = 'linear-gradient(155deg, #7A6850 0%, #B5A17E 22%, #D8C7A3 45%, #F2E8D3 62%, #B5A17E 85%, #7A6850 100%)'

export interface ProductCardProps {
  name: string
  featured?: boolean
  category: string
  description: string
  imageUrl: string
  badge: string | null
  variants: ProductVariant[]
}

export function ProductCard({ name, featured, category, description, imageUrl, badge, variants }: ProductCardProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  // Which sell unit the customer wants to buy -- only ever offered as a
  // real choice when this variant has a publicly enabled individual-vial
  // price (v.individualVialPrice is already gated by
  // lib/storefront/pricing.ts, never populated for a stored-but-disabled
  // price like Tesamorelin/AOD-9604/KLOW/Botulinum Toxin). Reset to
  // Standard Case whenever the selected size changes, so a size that
  // doesn't offer Individual Vial can never carry a stale selection.
  const [sellUnit, setSellUnit] = useState<SellUnit>('CASE_STANDARD')
  const { addItem, openCart } = useCartStore()

  const v = variants[selectedIdx]
  const canSelectIndividualVial = v.individualVialPrice != null
  const effectiveSellUnit: SellUnit = canSelectIndividualVial ? sellUnit : 'CASE_STANDARD'
  // Fulfillment state for the sell unit actually selected right now
  // (2026-08-15) -- must stay reactive as the customer toggles Standard
  // Case / Single Vial, never a single value fixed to the variant.
  const availability = effectiveSellUnit === 'INDIVIDUAL_VIAL' ? v.individualVialAvailability : v.caseAvailability
  const activePrice = effectiveSellUnit === 'INDIVIDUAL_VIAL' ? v.individualVialPrice : v.standardCasePrice
  const hasPrice = activePrice != null
  const canPurchase = hasPrice && isPurchasable(availability)

  function selectSize(i: number) {
    setSelectedIdx(i)
    setSellUnit('CASE_STANDARD')
  }

  function handleAdd() {
    if (!canPurchase || activePrice == null) return
    addItem({
      id: v.id,
      slug: v.slug,
      name,
      size: v.size,
      price: activePrice,
      imageUrl,
      backordered: availability === 'BACKORDERED',
      sellUnit: effectiveSellUnit,
      unitsPerSellUnit: effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 1 : v.unitsPerCase,
    })
    toast.success(`${name} ${v.size} (${effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 'Single Vial' : 'Standard Case'}) added to cart`)
    openCart()
  }

  return (
    // Champagne Bronze card surface (2026-08-15 metallic-card selection,
    // owner-approved preview) -- replaces the prior flat bg-[#0d0d0d].
    // Deliberately lighter/more muted than the existing Pepscore gold
    // (#F6D365/#D4AF37/#C99A20) so it reads as its own metal, not a
    // desaturated gold card. Border stays gold-tinted and brightens
    // further on hover -- gold remains the connective accent, not the
    // card surface itself. Every button/badge/CTA inside this card keeps
    // its existing colors untouched; only the outer surface and the two
    // plain (non-interactive) text/display elements below were adjusted
    // for contrast against the new lighter, warmer background.
    <article
      className="border border-[#D4AF37]/25 rounded-card overflow-hidden relative flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_36px_rgba(212,175,55,0.25)] hover:border-[#D4AF37]/75 group"
      style={{ background: CHAMPAGNE_BRONZE }}
    >
      {/* Badges — marketing badge (e.g. "Best Seller") takes the left corner;
          Featured (admin-set, Phase 2B item 6) takes the right so both can
          show at once without overlapping. */}
      {badge && (
        <div className="absolute top-3 left-3 z-10 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full">
          {badge}
        </div>
      )}
      {featured && (
        <div className="absolute top-3 right-3 z-10 bg-black/70 border border-[#D4AF37]/40 text-[#D4AF37] font-heading text-[9px] font-bold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full backdrop-blur">
          ★ Featured
        </div>
      )}

      {/* Image — single-vial only, never the lineup. Links to the currently
          selected variant's canonical detail page. Container kept
          compatible with the upcoming standardized vial photography --
          only the background/border treatment changed here, not the
          image logic itself. */}
      <Link href={`/products/${v.slug}`} className="bg-gradient-to-br from-[#161616] to-[#0a0a0a] h-[200px] flex items-center justify-center p-5 shrink-0">
        {imageUrl === GENERIC_PLACEHOLDER ? (
          /* Dynamic SVG vial with product name on the label */
          <SingleVialImage
            productName={name}
            className="h-[160px] w-auto drop-shadow-md transition-transform duration-300 group-hover:scale-[1.07] group-hover:-translate-y-1"
          />
        ) : (
          /* Product-specific photograph */
          <div className="relative h-[150px] w-full">
            <Image
              src={imageUrl}
              alt={name}
              fill
              className="object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-[1.07] group-hover:-translate-y-1"
              loading="lazy"
            />
          </div>
        )}
      </Link>

      {/* Card body — flex column so bottom section always aligns */}
      <div className="p-[18px] flex flex-col flex-1">
        {/* Category label — links to this product's primary merchandising
            category (lib/storefront/merchandisingTaxonomy.ts). A product
            can belong to more than one; the label itself still shows the
            authoritative Product.category value, only the link target
            changed. Falls back to the category index on the rare product
            with no taxonomy membership yet, rather than a dead link.
            Deep-gold refinement (2026-08-14): this label and the size span
            below were #D4AF37 (category label) / #D4AF37 at 80% opacity
            (size span), which read too pale against the lighter bands of
            the Champagne Bronze card surface. Both now use solid #C99A20 —
            same gold family, deeper existing token, no opacity reduction.
            Same value used for the "Save X%" text in app/page.tsx's
            Titanium tier cards for a consistent small-text gold weight
            across the storefront (not a literal shared constant — this
            component also renders on /search and /categories, which don't
            share a metallic background, so a cross-file JS import wasn't
            warranted for a single color decision). Product name, Add to
            Cart, and every other ProductCard element are untouched. */}
        <Link
          href={categoriesForProductName(name)[0] ? `/categories/${categoriesForProductName(name)[0].slug}` : '/categories'}
          className="font-heading text-[10px] font-bold tracking-[0.12em] uppercase text-[#C99A20] mb-1 hover:underline hover:text-[#D4AF37] inline-block w-fit transition-colors"
        >
          {category}
        </Link>

        {/* Product name + strength — the strength/unit label must always be
            visible here regardless of variant count. Before this fix, a
            single-strength product (most of the catalog -- MT-2,
            Dermorphin, HMG, Cerebrolysin, KLOW, Botulinum Toxin, etc.)
            never rendered its size anywhere on the card, because the size
            pills below only render when variants.length > 1. */}
        <Link href={`/products/${v.slug}`} className="flex items-center gap-2 mb-2 w-fit flex-wrap">
          <h3 className="font-heading text-[17px] font-bold text-[#241C10] leading-tight hover:text-[#D4AF37] transition-colors">{name}</h3>
          <span className="font-heading text-[11px] font-bold text-[#C99A20] tracking-[0.02em]">{v.size}</span>
          {availability === 'BACKORDERED' && <BackorderIndicator />}
        </Link>

        {/* Description — flex-1 so it absorbs variable space, keeping bottom section aligned */}
        <p className="text-[12px] text-[#241C10]/70 leading-relaxed flex-1 mb-3">{description}</p>

        {/* ── Bottom section — always pinned via flex-1 on description above ── */}
        <div className="flex flex-col gap-2.5">

          {/* Size selector pills */}
          {variants.length > 1 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#241C10]/55 mb-1.5">Select size</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((variant, i) => (
                  <button
                    key={variant.slug}
                    onClick={() => selectSize(i)}
                    // Unselected pill contrast fix (2026-08-15 refinement) --
                    // the prior border-only/text-white-60 treatment nearly
                    // disappeared against the lighter parts of the Champagne
                    // Bronze surface. A dark neutral chip (matching the same
                    // bg-black/15-20 convention already used for this card's
                    // price-display boxes) keeps unselected sizes clearly
                    // legible while staying visually secondary to the solid-
                    // gold selected pill -- selected state, dimensions, and
                    // layout are all unchanged.
                    className={`px-2.5 py-1 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] transition-all ${
                      i === selectedIdx
                        ? 'bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black'
                        : 'bg-black/20 border border-black/25 text-white/80 hover:bg-black/10 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                    }`}
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Availability badge (2026-08-15 fulfillment/availability sprint)
              -- now always shown, never omitted for the default state: a
              customer sees either "Ready to Ship" or the exception label
              (Produced to Order / Limited / Out of Stock / Coming Soon),
              never silence. AVAILABILITY_BADGE_CLASS/AVAILABILITY_LABEL
              both carry an AVAILABLE entry now (lib/storefront/availability.ts). */}
          <div className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.07em] ${AVAILABILITY_BADGE_CLASS[availability]}`}>
            {v.availabilityMessageOverride || AVAILABILITY_LABEL[availability]}
          </div>

          {hasPrice ? (
            <>
              {/* Sell-unit selector — a real, purchasable choice, not just a
                  reference number. Only rendered when this variant's
                  individual-vial price is publicly enabled
                  (lib/storefront/pricing.ts already withholds it entirely
                  for a stored-but-disabled price). When it isn't enabled but
                  Standard Case is available, a compact Special Request
                  inquiry replaces the toggle instead of showing nothing
                  (2026-08-15 fulfillment/availability sprint) -- sell-unit
                  availability is a purchasing-format decision independent
                  of Ready to Ship / Produced to Order above. */}
              {canSelectIndividualVial ? (
                <div className="flex gap-1.5">
                  {(['CASE_STANDARD', 'INDIVIDUAL_VIAL'] as const).map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setSellUnit(unit)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${
                        effectiveSellUnit === unit
                          ? 'bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black'
                          : 'border border-[#D4AF37]/25 text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                      }`}
                    >
                      {unit === 'CASE_STANDARD' ? 'Standard Case' : 'Single Vial'}
                    </button>
                  ))}
                </div>
              ) : (
                <LeadCaptureTrigger
                  interestType="SINGLE_VIAL_SPECIAL_REQUEST"
                  productSlug={v.slug}
                  productName={name}
                  productSize={v.size}
                  modalTitle={`Single Vial — Special Request: ${name} ${v.size}`}
                  modalDescription="Single-vial purchasing isn't directly enabled for this strength yet. Leave your info and our team will follow up about availability -- this is an inquiry, not a confirmed purchase."
                  triggerLabel="Single Vial — Special Request"
                  triggerClassName="text-left text-[10px] font-heading font-bold uppercase tracking-[0.04em] text-[#241C10]/55 hover:text-[#7A2E17] underline decoration-dotted underline-offset-2 transition-colors w-fit"
                  onOpen={() => trackEvent(AnalyticsEvent.SINGLE_VIAL_SPECIAL_REQUEST_CLICKED, { slug: v.slug, size: v.size })}
                />
              )}

              {/* Selected-unit price */}
              {/* Non-interactive price display -- background/text darkened
                  for contrast against the now-light champagne-bronze card;
                  not a button, so this is a contrast adjustment, not a
                  button-color change. */}
              <div className="bg-black/15 border border-black/20 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-[#241C10]/55 uppercase tracking-[0.07em] mb-0.5">
                    {effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 'Single Vial' : v.unitsPerCase ? `Case of ${v.unitsPerCase}` : 'Standard Case'}
                  </p>
                  <p className="font-heading text-[18px] font-extrabold text-[#241C10]">${activePrice}</p>
                </div>
                {canSelectIndividualVial && effectiveSellUnit === 'CASE_STANDARD' && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-[#241C10]/55 uppercase tracking-[0.07em] mb-0.5">Per Vial</p>
                    <p className="font-heading text-[14px] font-bold text-[#7A2E17]">${v.individualVialPrice}</p>
                  </div>
                )}
              </div>

              {/* SPA case price — only ever populated for an admin-granted
                  eligible signed-in customer, see lib/storefront/pricing.ts.
                  Standard Case pricing only; not offered for Individual Vial. */}
              {v.proCasePrice != null && effectiveSellUnit === 'CASE_STANDARD' && (
                <div className="bg-[#D4AF37]/8 border border-[#D4AF37]/25 rounded-lg p-2.5 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#D4AF37]">SPA Price</p>
                  <p className="font-heading text-[15px] font-bold text-[#D4AF37]">${v.proCasePrice}</p>
                </div>
              )}

              {/* Add to Cart CTA — disabled with a plain-language label
                  instead of hidden, so a priced-but-unavailable variant
                  still reads clearly rather than looking broken. */}
              <button
                onClick={handleAdd}
                disabled={!canPurchase}
                className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[11px] font-bold tracking-[0.05em] uppercase w-full py-2.5 rounded-full transition-all hover:scale-[1.02] disabled:bg-white/10 disabled:bg-none disabled:text-white/40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              >
                {canPurchase ? `Add to Cart${variants.length > 1 ? ` · ${v.size}` : ''}` : v.availabilityMessageOverride || AVAILABILITY_LABEL[availability]}
              </button>
            </>
          ) : (
            <>
              {/* No approved public price yet — never invent one */}
              <div className="bg-black/15 border border-black/20 rounded-lg p-3 text-center">
                <p className="text-[12px] font-heading font-semibold text-[#241C10]/75">Pricing available on request</p>
              </div>
              <Link
                href="/#contact"
                className="block border border-[#D4AF37]/45 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-heading text-[11px] font-bold tracking-[0.05em] uppercase w-full py-2.5 rounded-full transition-all text-center"
              >
                Request Pricing
              </Link>
            </>
          )}

        </div>
      </div>
    </article>
  )
}
