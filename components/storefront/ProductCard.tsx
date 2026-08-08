'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'
import { BackorderIndicator } from './BackorderIndicator'
import { isPurchasable, AVAILABILITY_LABEL, type StorefrontAvailability } from '@/lib/storefront/availability'
import { categoryToSlug } from '@/lib/storefront/categorySlug'

// Any imageUrl pointing at this path triggers the dynamic SVG vial renderer.
const GENERIC_PLACEHOLDER = '/images/products/default-single-vial.png'

const AVAILABILITY_BADGE_CLASS: Record<StorefrontAvailability, string> = {
  AVAILABLE: '', // default state -- no badge needed, keeps the common case uncluttered
  LIMITED: 'bg-amber-400/10 text-amber-300 border border-amber-400/30',
  // Purchasable (unlike OUT_OF_STOCK below) -- a distinct amber/gold tint
  // signals "still orderable, just delayed" rather than "unavailable."
  // The BackorderIndicator dot next to the product name is the primary
  // marker per the design spec; this badge is the existing
  // text-label mechanism every other non-AVAILABLE state already uses.
  BACKORDERED: 'bg-amber-400/10 text-amber-300 border border-amber-400/30',
  OUT_OF_STOCK: 'bg-white/5 text-white/50 border border-white/15',
  COMING_SOON: 'bg-white/5 text-white/50 border border-white/15',
}

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
  // customer (lib/storefront/spaEligibility.ts) -- never shown to a public
  // or standard-eligibility visitor regardless of what's stored.
  spaCasePrice: number | null
  // Real inventory-derived state, never the exact physical count. See
  // lib/storefront/availability.ts.
  availability: StorefrontAvailability
  // Admin-editable text (Phase 2B item 6) shown instead of the generic
  // AVAILABILITY_LABEL when set -- never changes the underlying
  // availability/purchasability itself.
  availabilityMessageOverride: string | null
}

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
  const { addItem, openCart } = useCartStore()

  const v = variants[selectedIdx]
  const hasPrice = v.standardCasePrice != null
  const canPurchase = hasPrice && isPurchasable(v.availability)

  function handleAdd() {
    if (!canPurchase || v.standardCasePrice == null) return
    addItem({ id: v.id, slug: v.slug, name, size: v.size, price: v.standardCasePrice, imageUrl, backordered: v.availability === 'BACKORDERED' })
    toast.success(`${name} ${v.size} added to cart`)
    openCart()
  }

  return (
    <article className="bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-card overflow-hidden relative flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-[#D4AF37]/40 group">
      {/* Badges — marketing badge (e.g. "Best Seller") takes the left corner;
          Featured (admin-set, Phase 2B item 6) takes the right so both can
          show at once without overlapping. */}
      {badge && (
        <div className="absolute top-3 left-3 z-10 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full">
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
        {/* Category label — links to the category page */}
        <Link
          href={`/categories/${categoryToSlug(category)}`}
          className="font-heading text-[10px] font-bold tracking-[0.12em] uppercase text-[#D4AF37] mb-1 hover:underline inline-block w-fit"
        >
          {category}
        </Link>

        {/* Product name — links to the currently selected variant's page */}
        <Link href={`/products/${v.slug}`} className="flex items-center gap-1.5 mb-2 w-fit">
          <h3 className="font-heading text-[17px] font-bold text-white leading-tight hover:text-[#D4AF37] transition-colors">{name}</h3>
          {v.availability === 'BACKORDERED' && <BackorderIndicator />}
        </Link>

        {/* Description — flex-1 so it absorbs variable space, keeping bottom section aligned */}
        <p className="text-[12px] text-white/55 leading-relaxed flex-1 mb-3">{description}</p>

        {/* ── Bottom section — always pinned via flex-1 on description above ── */}
        <div className="flex flex-col gap-2.5">

          {/* Size selector pills */}
          {variants.length > 1 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-white/40 mb-1.5">Select size</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((variant, i) => (
                  <button
                    key={variant.slug}
                    onClick={() => setSelectedIdx(i)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-heading font-bold tracking-[0.04em] transition-all ${
                      i === selectedIdx
                        ? 'bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black'
                        : 'border border-[#D4AF37]/25 text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                    }`}
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Availability badge — omitted for the default AVAILABLE state to
              keep the common case uncluttered; only shown for the exceptions. */}
          {v.availability !== 'AVAILABLE' && (
            <div className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.07em] ${AVAILABILITY_BADGE_CLASS[v.availability]}`}>
              {v.availabilityMessageOverride || AVAILABILITY_LABEL[v.availability]}
            </div>
          )}

          {hasPrice ? (
            <>
              {/* Standard case price */}
              <div className="bg-white/[0.03] border border-[#D4AF37]/15 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.07em] mb-0.5">
                    {v.unitsPerCase ? `Case of ${v.unitsPerCase}` : 'Standard Case'}
                  </p>
                  <p className="font-heading text-[18px] font-extrabold text-white">${v.standardCasePrice}</p>
                </div>
                {v.individualVialPrice != null && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.07em] mb-0.5">Per Vial</p>
                    <p className="font-heading text-[14px] font-bold text-[#D4AF37]">${v.individualVialPrice}</p>
                  </div>
                )}
              </div>

              {/* SPA case price — only ever populated for an admin-granted
                  eligible signed-in customer, see lib/storefront/pricing.ts */}
              {v.spaCasePrice != null && (
                <div className="bg-[#D4AF37]/8 border border-[#D4AF37]/25 rounded-lg p-2.5 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#D4AF37]">SPA Price</p>
                  <p className="font-heading text-[15px] font-bold text-[#D4AF37]">${v.spaCasePrice}</p>
                </div>
              )}

              {/* Add to Cart CTA — disabled with a plain-language label
                  instead of hidden, so a priced-but-unavailable variant
                  still reads clearly rather than looking broken. */}
              <button
                onClick={handleAdd}
                disabled={!canPurchase}
                className="bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[11px] font-bold tracking-[0.05em] uppercase w-full py-2.5 rounded-full transition-all hover:scale-[1.02] disabled:bg-white/10 disabled:bg-none disabled:text-white/40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              >
                {canPurchase ? `Add to Cart${variants.length > 1 ? ` · ${v.size}` : ''}` : v.availabilityMessageOverride || AVAILABILITY_LABEL[v.availability]}
              </button>
            </>
          ) : (
            <>
              {/* No approved public price yet — never invent one */}
              <div className="bg-white/[0.03] border border-[#D4AF37]/15 rounded-lg p-3 text-center">
                <p className="text-[12px] font-heading font-semibold text-white/60">Pricing available on request</p>
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
