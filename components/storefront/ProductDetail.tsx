// Product detail page content — the interactive (cart) part of an
// otherwise server-rendered page. One Product row is one specific
// strength/size, so unlike ProductCard there's no in-place variant
// switcher here; sibling strengths are separate pages, linked via
// "Related Strengths" below.
'use client'

import Image from 'next/image'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'
import { AVAILABILITY_LABEL, isPurchasable, type StorefrontAvailability } from '@/lib/storefront/availability'
import type { StorefrontPrice } from '@/lib/storefront/pricing'

const GENERIC_PLACEHOLDER = '/images/products/default-single-vial.png'

const AVAILABILITY_BADGE_CLASS: Record<StorefrontAvailability, string> = {
  AVAILABLE: 'bg-green-50 text-green-700 border border-green-200',
  LIMITED: 'bg-amber-100 text-amber-800 border border-amber-300',
  OUT_OF_STOCK: 'bg-g100 text-g700 border border-g300',
  COMING_SOON: 'bg-g100 text-g700 border border-g300',
}

export interface RelatedStrength {
  slug: string
  size: string
}

export interface ProductDetailProps {
  id: string
  slug: string
  name: string
  size: string
  category: string
  imageUrl: string
  description: string
  price: StorefrontPrice | null
  availability: StorefrontAvailability
  relatedStrengths: RelatedStrength[]
  sku: string | null
}

export function ProductDetail({ id, slug, name, size, category, imageUrl, description, price, availability, relatedStrengths, sku }: ProductDetailProps) {
  const { addItem, openCart } = useCartStore()
  const canPurchase = price != null && isPurchasable(availability)

  function handleAdd() {
    if (!canPurchase || price == null) return
    addItem({ id, slug, name, size, price: price.standardCasePrice, imageUrl })
    toast.success(`${name} ${size} added to cart`)
    openCart()
  }

  return (
    <main className="bg-cream min-h-screen">
      {/* Breadcrumbs */}
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
        <nav aria-label="Breadcrumb" className="text-[12px] text-g500 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gold transition-colors">Home</Link>
          <span>/</span>
          <Link href="/#products" className="hover:text-gold transition-colors">Products</Link>
          <span>/</span>
          <span className="text-dark font-semibold">{name} {size}</span>
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-14">
        {/* Image */}
        <div className="bg-gradient-to-br from-cream to-[#F5EFE0] rounded-card border border-gold/15 flex items-center justify-center p-10 h-[380px] lg:h-[460px]">
          {imageUrl === GENERIC_PLACEHOLDER ? (
            <SingleVialImage productName={name} className="h-[280px] w-auto drop-shadow-md" />
          ) : (
            <div className="relative h-[300px] w-full">
              <Image src={imageUrl} alt={`${name} ${size}`} fill className="object-contain drop-shadow-md" priority />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="font-heading text-[11px] font-bold tracking-[0.12em] uppercase text-gold mb-2">{category}</p>
          <h1 className="font-heading text-[clamp(26px,3.5vw,36px)] font-bold text-dark leading-tight mb-1">{name}</h1>
          <p className="text-[16px] text-g500 font-light mb-4">{size}</p>

          {availability !== 'AVAILABLE' && (
            <div className={`inline-flex w-fit items-center rounded-full px-3 py-1 mb-4 text-[10px] font-bold uppercase tracking-[0.07em] ${AVAILABILITY_BADGE_CLASS[availability]}`}>
              {AVAILABILITY_LABEL[availability]}
            </div>
          )}

          <p className="text-[15px] text-g700 leading-[1.8] mb-6">{description}</p>

          {/* Pricing + CTA */}
          <div className="bg-white border border-gold/15 rounded-2xl p-6 mb-6">
            {price ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-g500 uppercase tracking-[0.07em] mb-1">
                      {price.unitsPerCase ? `Standard Case — Case of ${price.unitsPerCase}` : 'Standard Case'}
                    </p>
                    <p className="font-heading text-[28px] font-extrabold text-dark">${price.standardCasePrice}</p>
                  </div>
                  {price.individualVialPrice != null && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-g500 uppercase tracking-[0.07em] mb-1">Per Vial</p>
                      <p className="font-heading text-[20px] font-bold text-gold">${price.individualVialPrice}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleAdd}
                  disabled={!canPurchase}
                  className="w-full bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-md transition-all disabled:bg-g300 disabled:text-g700 disabled:cursor-not-allowed"
                >
                  {canPurchase ? 'Add to Cart' : AVAILABILITY_LABEL[availability]}
                </button>
              </>
            ) : (
              <>
                <p className="text-[14px] font-heading font-semibold text-g700 mb-4 text-center">Pricing available on request</p>
                <Link
                  href="/#contact"
                  className="block text-center border-2 border-gold text-gold-dark hover:bg-gold hover:text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3.5 rounded-md transition-all"
                >
                  Request Pricing
                </Link>
              </>
            )}
          </div>

          {/* Specifications */}
          <div className="border-t border-g100 pt-5 mb-6">
            <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-dark mb-3">Specifications</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-g500">Category</dt>
              <dd className="text-dark font-semibold">{category}</dd>
              <dt className="text-g500">Strength</dt>
              <dd className="text-dark font-semibold">{size}</dd>
              {sku && (
                <>
                  <dt className="text-g500">SKU</dt>
                  <dd className="text-dark font-semibold">{sku}</dd>
                </>
              )}
            </dl>
          </div>

          {/* RUO notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mb-6">
            <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-[13px] text-g700 leading-relaxed">
              <strong>Research Use Only:</strong> Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Must be handled by qualified researchers in appropriate laboratory environments.
            </p>
          </div>

          {/* Related strengths */}
          {relatedStrengths.length > 0 && (
            <div>
              <h2 className="font-heading text-[13px] font-bold tracking-[0.08em] uppercase text-dark mb-3">Other Strengths</h2>
              <div className="flex flex-wrap gap-2">
                {relatedStrengths.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/products/${r.slug}`}
                    className="px-3.5 py-2 rounded-md border border-gold/30 text-[12px] font-heading font-bold text-g700 hover:border-gold hover:text-gold transition-all"
                  >
                    {r.size}
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
