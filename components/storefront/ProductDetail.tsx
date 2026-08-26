// Product detail page content — the interactive (cart) part of an
// otherwise server-rendered page. One Product row is one specific
// strength/size, so unlike ProductCard there's no in-place variant
// switcher here; sibling strengths are separate pages, linked via
// "Related Strengths" below.
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'
import { BackorderIndicator } from './BackorderIndicator'
import { BackorderLegend } from './BackorderLegend'
import { AVAILABILITY_LABEL, AVAILABILITY_BADGE_CLASS, isPurchasable, type StorefrontAvailability } from '@/lib/storefront/availability'
import type { StorefrontPrice } from '@/lib/storefront/pricing'
import type { SellUnit } from '@/lib/pricing/sellUnits'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'
import { trackProductEngagement } from '@/lib/analytics/productEngagementClient'
import { ScientificBackground } from './ScientificBackground'

const GENERIC_PLACEHOLDER = '/images/products/default-single-vial.png'

export interface RelatedStrength {
  slug: string
  size: string
}

export interface RelatedProduct {
  slug: string
  name: string
  size: string
}

export interface FaqEntry {
  question: string
  answer: string
}

export interface ProductDetailProps {
  id: string
  slug: string
  name: string
  size: string
  category: string
  imageUrl: string
  imageAlt: string
  description: string
  price: StorefrontPrice | null
  // Split by sell unit (2026-08-15) -- same reasoning as
  // ProductCard.ProductVariant, see that interface's comment.
  caseAvailability: StorefrontAvailability
  individualVialAvailability: StorefrontAvailability
  availabilityMessageOverride: string | null
  relatedStrengths: RelatedStrength[]
  relatedProducts: RelatedProduct[]
  faq: FaqEntry[]
  sku: string | null
  // Customer Preferred Pricing (Price Match sprint, 2026-08-20) -- same
  // shape and same display-guard rule as ProductCard.ProductVariant's
  // preferredPricesBySellUnit. Purely informational; checkout independently
  // re-validates and applies (or doesn't) the real authorization.
  preferredPricesBySellUnit?: Partial<Record<SellUnit, number>>
}

// Integrated metallic frame (2026-08-17 black-frame reduction sprint,
// owner-approved "Option C") -- the prior treatment was p-10 (40px)
// padding over a flat dark gradient panel, which measured out to only
// 41.6% real photo coverage of the image box (40px fixed padding, plus a
// second ~37px object-contain gap on left/right from the padded content
// area's aspect ratio not matching the photo's own 1.9:1). This tight
// 4px padding + page-matched black background (so the box doesn't read as
// a separate panel) + a refined double-edge gold border (hairline border
// plus an inset glow) gets to 93%+ coverage while keeping a deliberate,
// premium edge rather than either a heavy surround or raw edge-to-edge.

export function ProductDetail({
  id,
  slug,
  name,
  size,
  category,
  imageUrl,
  imageAlt,
  description,
  price,
  caseAvailability,
  individualVialAvailability,
  availabilityMessageOverride,
  relatedStrengths,
  relatedProducts,
  preferredPricesBySellUnit,
  faq,
  sku,
}: ProductDetailProps) {
  const { addItem, openCart } = useCartStore()

  // Sell-unit toggle (2026-08-15 parity fix) -- this page previously only
  // ever offered Standard Case, even for a variant whose ProductCard
  // exposed a working Standard Case / Single Vial toggle (same
  // canSelectIndividualVial / effectiveSellUnit pattern as
  // components/storefront/ProductCard.tsx, so the two surfaces can never
  // disagree about what's purchasable). This page has no in-place variant
  // switcher (sibling strengths are separate routes via "Other Strengths"
  // below) -- app/products/[slug]/page.tsx keys this component by
  // product.id, so React fully remounts it (fresh useState) on navigation
  // between two /products/[slug] routes, rather than reusing state across
  // products. A Single-Vial selection on one strength can never carry over
  // as a stale selection on a case-only sibling.
  const [sellUnit, setSellUnit] = useState<SellUnit>('CASE_STANDARD')

  // Professional purchasing experience (section 7) -- same rule as
  // ProductCard: true only when this visitor is Professional-eligible AND
  // this exact product/strength has a Professional price.
  const professionalMode = price?.proCasePrice != null
  const canSelectIndividualVial = !professionalMode && price?.individualVialPrice != null
  const effectiveSellUnit: SellUnit = professionalMode ? 'CASE_PRO' : canSelectIndividualVial ? sellUnit : 'CASE_STANDARD'
  // Fulfillment state for the sell unit actually selected right now
  // (2026-08-15) -- must stay reactive as the customer toggles Standard
  // Case / Single Vial, never a single value fixed to the variant. Same
  // pattern as ProductCard. Professional Case shares Standard Case's
  // physical stock pool, so it reads caseAvailability too.
  const availability = effectiveSellUnit === 'INDIVIDUAL_VIAL' ? individualVialAvailability : caseAvailability
  const activePrice = price == null ? null : professionalMode ? price.proCasePrice : effectiveSellUnit === 'INDIVIDUAL_VIAL' ? price.individualVialPrice : price.standardCasePrice
  const canPurchase = activePrice != null && isPurchasable(availability)
  // Customer Preferred Pricing -- same display-guard rule as ProductCard
  // (only shown when strictly better than the price already displayed).
  // Purely informational; checkout independently re-resolves and applies
  // the real authorization regardless of what this page shows.
  const rawPreferredPrice = preferredPricesBySellUnit?.[effectiveSellUnit] ?? null
  const preferredPrice = rawPreferredPrice != null && activePrice != null && rawPreferredPrice < activePrice ? rawPreferredPrice : null

  // Fired once per page load, not per render -- deliberately excludes
  // `category`/`availability` etc. from the dependency array since this
  // should only ever represent "a visitor landed on this product," not
  // re-fire if the same page's derived props happen to change identity.
  useEffect(() => {
    trackEvent(AnalyticsEvent.PRODUCT_VIEW, { slug, category, availability })
    // Distinct named event (2026-08-15) alongside PRODUCT_VIEW's own
    // `availability` property -- a purpose-built event a future admin
    // demand-insight query can read directly, rather than requiring every
    // consumer to know to filter PRODUCT_VIEW by availability itself.
    if (availability === 'BACKORDERED') {
      trackEvent(AnalyticsEvent.PRODUCED_TO_ORDER_VIEWED, { slug, category })
    }
    // First-party record (AI-1.2) alongside the third-party trackEvent()
    // calls above, not instead of them -- see lib/analytics/
    // productEngagementClient.ts.
    trackProductEngagement({ productId: id, productName: name, category, eventType: 'VIEW' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  function handleAdd() {
    if (!canPurchase || activePrice == null || price == null) return
    addItem({
      id,
      slug,
      name,
      size,
      price: activePrice,
      imageUrl,
      backordered: availability === 'BACKORDERED',
      sellUnit: effectiveSellUnit,
      unitsPerSellUnit: effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 1 : price.unitsPerCase ?? 10,
    })
    toast.success(`${name} ${size} (${professionalMode ? 'Professional Case' : effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 'Single Vial' : 'Standard Case'}) added to cart`)
    openCart()
  }

  return (
    <main className="relative overflow-hidden bg-black min-h-screen">
      {/* Corner watermark only -- product content (image, price, Add to
          Cart) must stay fully dominant here, so this is confined to a
          fixed-height region at the top rather than a full-bleed
          treatment down the whole page. `fadeLeft` removed (2026-08-26) --
          it painted a real black gradient specifically over the LEFT HALF
          of this confined band (bg-gradient-to-r from-black via-black/40
          to-transparent, see ScientificBackground.tsx), directly behind
          the info column's category label/title/size text below, which --
          unlike ProductCard -- has no opaque card/chip background of its
          own to sit on top of (this page's text renders straight onto
          `bg-black` above). `position="object-right"` already keeps the
          DNA-art motif itself clear of that left-aligned text; fadeLeft
          was actively working against that by darkening exactly the
          region the text occupies. Removing it leaves the same subtle,
          right-positioned watermark with nothing extra layered over the
          text. */}
      <div className="absolute inset-x-0 top-0 h-[480px]">
        <ScientificBackground intensity="subtle" position="object-right" />
      </div>
      {/* Breadcrumbs */}
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2 relative">
        <nav aria-label="Breadcrumb" className="text-[12px] text-white/45 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-[#D4AF37] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/#products" className="hover:text-[#D4AF37] transition-colors">Products</Link>
          <span>/</span>
          <span className="text-white font-semibold">{name} {size}</span>
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-14">
        {/* Image -- 2026-08-17 reshaped toward the same ~1.9:1 wide/cinematic
            ratio as ProductCard's image box (owner request, matching the
            vialSample.png photography standard), replacing the prior fixed
            h-[380px]/lg:h-[460px] (which produced a near-square/portrait box
            the wide photo top/bottom-letterboxed inside). aspect-[1.9/1] on
            the outer box + h-full (was h-[300px] fixed) on the inner Image
            wrapper so the real-photo branch fills whatever height the
            aspect-ratio box actually computes at any viewport width, instead
            of a second, independent fixed height. SingleVialImage (SVG
            placeholder) branch is untouched. Frame treatment ("Option C")
            below. */}
        <div className="flex items-center justify-center aspect-[1.9/1] bg-black rounded-card border border-[#D4AF37]/40 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.18)] p-1">
          {imageUrl === GENERIC_PLACEHOLDER ? (
            <SingleVialImage productName={name} className="h-[280px] w-auto drop-shadow-md" />
          ) : (
            <div className="relative h-full w-full">
              <Image src={imageUrl} alt={imageAlt} fill className="object-contain drop-shadow-md" priority />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="font-heading text-[11px] font-bold tracking-[0.12em] uppercase text-[#D4AF37] mb-2">{category}</p>
          <h1 className="font-heading text-[clamp(26px,3.5vw,36px)] font-bold text-white leading-tight mb-1 flex items-center gap-2">
            {name}
            {availability === 'BACKORDERED' && <BackorderIndicator />}
          </h1>
          <p className="text-[16px] text-white/50 font-light mb-4">{size}</p>

          {/* Always shown (2026-08-15 fulfillment/availability sprint) --
              same parity change as ProductCard: a customer sees either
              "Ready to Ship" or the exception label, never silence. */}
          <div className={`inline-flex w-fit items-center rounded-full px-3 py-1 mb-4 text-[10px] font-bold uppercase tracking-[0.07em] ${AVAILABILITY_BADGE_CLASS[availability]}`}>
            {availabilityMessageOverride || AVAILABILITY_LABEL[availability]}
          </div>

          <p className="text-[15px] text-white/65 leading-[1.8] mb-6 whitespace-pre-line">{description}</p>

          {/* Pricing + CTA */}
          <div className="bg-white/[0.03] border border-[#D4AF37]/15 rounded-2xl p-6 mb-6">
            {price ? (
              <>
                {professionalMode ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#D4AF37] bg-white/[0.04] border border-[#D4AF37]/25 rounded-full px-3 py-1 mb-4 w-fit">
                    Professional Access
                  </p>
                ) : canSelectIndividualVial ? (
                  /* Sell-unit selector -- only rendered when this exact
                      variant's individual-vial price is publicly enabled
                      (lib/storefront/pricing.ts withholds it entirely for a
                      stored-but-disabled price), same gate ProductCard uses. */
                  <div className="flex gap-2 mb-4">
                    {(['CASE_STANDARD', 'INDIVIDUAL_VIAL'] as const).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => setSellUnit(unit)}
                        className={`flex-1 px-3 py-2 rounded-lg text-[11px] font-heading font-bold tracking-[0.04em] uppercase transition-all ${
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
                  // When it isn't enabled but Standard Case is available, a
                  // compact Special Request inquiry replaces the toggle
                  // instead of showing nothing (2026-08-15 fulfillment/
                  // availability sprint) -- same parity as ProductCard.
                  // Never shown in Professional mode (section 7).
                  <div className="mb-4">
                    <LeadCaptureTrigger
                      interestType="SINGLE_VIAL_SPECIAL_REQUEST"
                      productSlug={slug}
                      productName={name}
                      productSize={size}
                      modalTitle={`Single Vial — Special Request: ${name} ${size}`}
                      modalDescription="Single-vial purchasing isn't directly enabled for this strength yet. Leave your info and our team will follow up about availability -- this is an inquiry, not a confirmed purchase."
                      triggerLabel="Single Vial — Special Request"
                      triggerClassName="text-left text-[11px] font-heading font-bold uppercase tracking-[0.04em] text-white/45 hover:text-[#D4AF37] underline decoration-dotted underline-offset-2 transition-colors w-fit"
                      onOpen={() => trackEvent(AnalyticsEvent.SINGLE_VIAL_SPECIAL_REQUEST_CLICKED, { slug, size })}
                    />
                  </div>
                )}

                {preferredPrice != null ? (
                  // Customer Preferred Pricing -- final precedence, same
                  // rule the canonical engine enforces server-side (never
                  // stacks, only ever wins when strictly better). Whatever
                  // price would otherwise show is struck through above it.
                  <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/35 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em]">
                        {professionalMode ? (price.unitsPerCase ? `Professional Case — Case of ${price.unitsPerCase}` : 'Professional Case') : effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 'Single Vial' : price.unitsPerCase ? `Standard Case — Case of ${price.unitsPerCase}` : 'Standard Case'}
                      </p>
                      <span className="text-[13px] font-heading font-bold text-white/35 line-through">${activePrice}</span>
                    </div>
                    <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.07em] mb-1">Your Preferred Price</p>
                    <p className="font-heading text-[32px] font-extrabold text-[#D4AF37]">${preferredPrice}</p>
                  </div>
                ) : professionalMode ? (
                  // Professional Access pricing reads as an account
                  // entitlement, not a coupon (section 7) -- Standard struck
                  // through, Professional prominent, no competing selectable
                  // options shown.
                  <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/35 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em]">
                        {price.unitsPerCase ? `Professional Case — Case of ${price.unitsPerCase}` : 'Professional Case'}
                      </p>
                      <span className="text-[13px] font-heading font-bold text-white/35 line-through">${price.standardCasePrice}</span>
                    </div>
                    <p className="font-heading text-[32px] font-extrabold text-[#D4AF37]">${activePrice}</p>
                    <p className="text-[11px] text-white/45 mt-1.5">Ships in approximately 2 weeks — produced to order for Professional accounts.</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em] mb-1">
                        {effectiveSellUnit === 'INDIVIDUAL_VIAL' ? 'Single Vial' : price.unitsPerCase ? `Standard Case — Case of ${price.unitsPerCase}` : 'Standard Case'}
                      </p>
                      <p className="font-heading text-[28px] font-extrabold text-white">${activePrice}</p>
                    </div>
                    {canSelectIndividualVial && effectiveSellUnit === 'CASE_STANDARD' && (
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em] mb-1">Per Vial</p>
                        <p className="font-heading text-[20px] font-bold text-[#D4AF37]">${price.individualVialPrice}</p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={!canPurchase}
                  className="w-full bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-full transition-all disabled:bg-white/10 disabled:bg-none disabled:text-white/40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {canPurchase ? 'Add to Cart' : availabilityMessageOverride || AVAILABILITY_LABEL[availability]}
                </button>

                {availability === 'BACKORDERED' && (
                  <div className="mt-3">
                    <BackorderLegend />
                  </div>
                )}

                {!canPurchase && (availability === 'OUT_OF_STOCK' || availability === 'COMING_SOON') && (
                  <LeadCaptureTrigger
                    interestType={availability === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK_INTEREST' : 'NOTIFY_WHEN_AVAILABLE'}
                    productSlug={slug}
                    productName={name}
                    productSize={size}
                    modalTitle={`Get notified — ${name} ${size}`}
                    modalDescription={
                      availability === 'OUT_OF_STOCK'
                        ? "This item is currently out of stock. Leave your info and we'll let you know when it's back."
                        : "This item isn't available yet. Leave your info and we'll let you know when it launches."
                    }
                    triggerLabel="Notify Me"
                    triggerClassName="w-full mt-2.5 border border-[#D4AF37]/45 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full transition-all"
                  />
                )}
              </>
            ) : (
              <>
                <p className="text-[14px] font-heading font-semibold text-white/60 mb-4 text-center">Pricing available on request</p>
                <LeadCaptureTrigger
                  interestType="PRICING_REVIEW_INTEREST"
                  productSlug={slug}
                  productName={name}
                  productSize={size}
                  modalTitle={`Request pricing — ${name} ${size}`}
                  modalDescription="This product is still going through pricing review. Leave your info and we'll follow up with pricing details."
                  showMessageField
                  triggerLabel="Request Pricing"
                  triggerClassName="block w-full text-center border border-[#D4AF37]/45 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-full transition-all"
                />
              </>
            )}
          </div>

          {/* Specifications */}
          <div className="border-t border-white/10 pt-5 mb-6">
            <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-white mb-3">Specifications</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-white/45">Category</dt>
              <dd className="text-white font-semibold">{category}</dd>
              <dt className="text-white/45">Strength</dt>
              <dd className="text-white font-semibold">{size}</dd>
              {sku && (
                <>
                  <dt className="text-white/45">SKU</dt>
                  <dd className="text-white font-semibold">{sku}</dd>
                </>
              )}
            </dl>
          </div>

          {/* RUO notice */}
          <div className="bg-amber-400/10 border border-amber-400/25 rounded-xl p-4 flex gap-3 items-start mb-6">
            <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-[13px] text-white/70 leading-relaxed">
              <strong className="text-white">Research Use Only:</strong> Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Must be handled by qualified researchers in appropriate laboratory environments.
            </p>
          </div>

          {/* FAQ (admin-editable, Phase 2B item 6) */}
          {faq.length > 0 && (
            <div className="border-t border-white/10 pt-5 mb-6">
              <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-white mb-3">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faq.map((f, i) => (
                  <div key={i}>
                    <p className="text-[13px] font-heading font-bold text-white mb-1">{f.question}</p>
                    <p className="text-[13px] text-white/60 leading-relaxed">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related strengths — same product name, other Product rows */}
          {relatedStrengths.length > 0 && (
            <div className="mb-6">
              <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-white mb-3">Other Strengths</h2>
              <div className="flex flex-wrap gap-2">
                {relatedStrengths.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/products/${r.slug}`}
                    className="px-3.5 py-2 rounded-full border border-[#D4AF37]/25 text-[12px] font-heading font-bold text-white/70 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all"
                  >
                    {r.size}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related products — admin-curated (Phase 2B item 6), distinct
              products entirely, e.g. a reconstitution water for a peptide */}
          {relatedProducts.length > 0 && (
            <div>
              <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-white mb-3">Related Products</h2>
              <div className="flex flex-wrap gap-2">
                {relatedProducts.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/products/${r.slug}`}
                    className="px-3.5 py-2 rounded-full border border-[#D4AF37]/25 text-[12px] font-heading font-bold text-white/70 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all"
                  >
                    {r.name} {r.size}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
