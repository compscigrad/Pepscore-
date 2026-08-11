// Product detail page content — the interactive (cart) part of an
// otherwise server-rendered page. One Product row is one specific
// strength/size, so unlike ProductCard there's no in-place variant
// switcher here; sibling strengths are separate pages, linked via
// "Related Strengths" below.
'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'
import { BackorderIndicator } from './BackorderIndicator'
import { BackorderLegend } from './BackorderLegend'
import { AVAILABILITY_LABEL, isPurchasable, type StorefrontAvailability } from '@/lib/storefront/availability'
import type { StorefrontPrice } from '@/lib/storefront/pricing'
import { trackEvent } from '@/lib/analytics/track'
import { AnalyticsEvent } from '@/lib/analytics/events'

const GENERIC_PLACEHOLDER = '/images/products/default-single-vial.png'

const AVAILABILITY_BADGE_CLASS: Record<StorefrontAvailability, string> = {
  AVAILABLE: 'bg-green-400/10 text-green-300 border border-green-400/25',
  LIMITED: 'bg-amber-400/10 text-amber-300 border border-amber-400/30',
  BACKORDERED: 'bg-amber-400/10 text-amber-300 border border-amber-400/30',
  OUT_OF_STOCK: 'bg-white/5 text-white/50 border border-white/15',
  COMING_SOON: 'bg-white/5 text-white/50 border border-white/15',
}

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
  availability: StorefrontAvailability
  availabilityMessageOverride: string | null
  relatedStrengths: RelatedStrength[]
  relatedProducts: RelatedProduct[]
  faq: FaqEntry[]
  sku: string | null
}

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
  availability,
  availabilityMessageOverride,
  relatedStrengths,
  relatedProducts,
  faq,
  sku,
}: ProductDetailProps) {
  const { addItem, openCart } = useCartStore()
  const canPurchase = price != null && isPurchasable(availability)

  // Fired once per page load, not per render -- deliberately excludes
  // `category`/`availability` etc. from the dependency array since this
  // should only ever represent "a visitor landed on this product," not
  // re-fire if the same page's derived props happen to change identity.
  useEffect(() => {
    trackEvent(AnalyticsEvent.PRODUCT_VIEW, { slug, category, availability })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  function handleAdd() {
    if (!canPurchase || price == null) return
    // Standard Case is the only tier this page's own "Add to Cart" button
    // has ever offered -- explicitly tagging the line as such (rather than
    // leaving sellUnit unset) means it correctly gets its own cart line
    // even if a future page/flow (e.g. Buy Again resolving an Individual
    // Vial purchase) adds a differently-tiered line for the same product.
    addItem({
      id,
      slug,
      name,
      size,
      price: price.standardCasePrice,
      imageUrl,
      backordered: availability === 'BACKORDERED',
      sellUnit: 'CASE_STANDARD',
      unitsPerSellUnit: price.unitsPerCase ?? 10,
    })
    toast.success(`${name} ${size} added to cart`)
    openCart()
  }

  return (
    <main className="bg-black min-h-screen">
      {/* Breadcrumbs */}
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
        <nav aria-label="Breadcrumb" className="text-[12px] text-white/45 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-[#D4AF37] transition-colors">Home</Link>
          <span>/</span>
          <Link href="/#products" className="hover:text-[#D4AF37] transition-colors">Products</Link>
          <span>/</span>
          <span className="text-white font-semibold">{name} {size}</span>
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-14">
        {/* Image */}
        <div className="bg-gradient-to-br from-[#161616] to-[#0a0a0a] rounded-card border border-[#D4AF37]/15 flex items-center justify-center p-10 h-[380px] lg:h-[460px]">
          {imageUrl === GENERIC_PLACEHOLDER ? (
            <SingleVialImage productName={name} className="h-[280px] w-auto drop-shadow-md" />
          ) : (
            <div className="relative h-[300px] w-full">
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

          {availability !== 'AVAILABLE' && (
            <div className={`inline-flex w-fit items-center rounded-full px-3 py-1 mb-4 text-[10px] font-bold uppercase tracking-[0.07em] ${AVAILABILITY_BADGE_CLASS[availability]}`}>
              {availabilityMessageOverride || AVAILABILITY_LABEL[availability]}
            </div>
          )}

          <p className="text-[15px] text-white/65 leading-[1.8] mb-6 whitespace-pre-line">{description}</p>

          {/* Pricing + CTA */}
          <div className="bg-white/[0.03] border border-[#D4AF37]/15 rounded-2xl p-6 mb-6">
            {price ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em] mb-1">
                      {price.unitsPerCase ? `Standard Case — Case of ${price.unitsPerCase}` : 'Standard Case'}
                    </p>
                    <p className="font-heading text-[28px] font-extrabold text-white">${price.standardCasePrice}</p>
                  </div>
                  {price.individualVialPrice != null && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.07em] mb-1">Per Vial</p>
                      <p className="font-heading text-[20px] font-bold text-[#D4AF37]">${price.individualVialPrice}</p>
                    </div>
                  )}
                </div>

                {/* SPA case price — only ever populated for an admin-granted
                    eligible signed-in customer, see lib/storefront/pricing.ts */}
                {price.spaCasePrice != null && (
                  <div className="bg-[#D4AF37]/8 border border-[#D4AF37]/25 rounded-lg p-3 flex items-center justify-between mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D4AF37]">SPA Price</p>
                    <p className="font-heading text-[18px] font-bold text-[#D4AF37]">${price.spaCasePrice}</p>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={!canPurchase}
                  className="w-full bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-full transition-all disabled:bg-white/10 disabled:bg-none disabled:text-white/40 disabled:cursor-not-allowed disabled:shadow-none"
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
