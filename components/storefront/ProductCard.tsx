'use client'

import { useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { SingleVialImage } from './SingleVialImage'

// Any imageUrl pointing at this path triggers the dynamic SVG vial renderer.
const GENERIC_PLACEHOLDER = '/images/vial-placeholder.png'

export interface ProductVariant {
  id: string
  slug: string
  size: string
  price: number
  bulkPrice5: number
  bulkPrice10: number
}

export interface ProductCardProps {
  name: string
  category: string
  description: string
  imageUrl: string
  badge: string | null
  variants: ProductVariant[]
}

export function ProductCard({ name, category, description, imageUrl, badge, variants }: ProductCardProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const { addItem, openCart } = useCartStore()

  const v = variants[selectedIdx]

  function handleAdd() {
    addItem({ id: v.id, slug: v.slug, name, size: v.size, price: v.price, imageUrl })
    toast.success(`${name} ${v.size} added to cart`)
    openCart()
  }

  return (
    <article className="bg-white border border-gold/15 rounded-card overflow-hidden relative flex flex-col transition-all duration-300 hover:-translate-y-1.5 hover:shadow-sl hover:border-gold group">
      {/* Badge */}
      {badge && (
        <div className="absolute top-3 left-3 z-10 bg-gold text-white font-heading text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-1 rounded">
          {badge}
        </div>
      )}

      {/* Image — single-vial only, never the lineup */}
      <div className="bg-gradient-to-br from-cream to-[#F5EFE0] h-[200px] flex items-center justify-center p-5 shrink-0">
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
      </div>

      {/* Card body — flex column so bottom section always aligns */}
      <div className="p-[18px] flex flex-col flex-1">
        {/* Category label */}
        <p className="font-heading text-[10px] font-bold tracking-[0.12em] uppercase text-gold mb-1">{category}</p>

        {/* Product name */}
        <h3 className="font-heading text-[17px] font-bold text-dark leading-tight mb-2">{name}</h3>

        {/* Description — flex-1 so it absorbs variable space, keeping bottom section aligned */}
        <p className="text-[12px] text-g700 leading-relaxed flex-1 mb-3">{description}</p>

        {/* ── Bottom section — always pinned via flex-1 on description above ── */}
        <div className="flex flex-col gap-2.5">

          {/* Size selector pills */}
          {variants.length > 1 && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Select size</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((variant, i) => (
                  <button
                    key={variant.slug}
                    onClick={() => setSelectedIdx(i)}
                    className={`px-2.5 py-1 rounded text-[11px] font-heading font-bold tracking-[0.04em] transition-all ${
                      i === selectedIdx
                        ? 'bg-gold text-white shadow-sm'
                        : 'border border-gold/30 text-g700 hover:border-gold hover:text-gold'
                    }`}
                  >
                    {variant.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3-tier pricing table */}
          <div className="bg-[#FDFAF5] border border-gold/15 rounded-lg p-3">
            <div className="grid grid-cols-3 text-center divide-x divide-gold/15">
              <div className="px-1">
                <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">1 box</p>
                <p className="font-heading text-[14px] font-extrabold text-dark">${v.price}</p>
              </div>
              <div className="px-1">
                <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">10 boxes</p>
                <p className="font-heading text-[14px] font-extrabold text-gold">${v.bulkPrice5}</p>
              </div>
              <div className="px-1">
                <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">50 boxes</p>
                <p className="font-heading text-[14px] font-extrabold text-gold">${v.bulkPrice10}</p>
              </div>
            </div>
          </div>

          {/* Bulk discount badge — consistent position across all cards */}
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/30 bg-gold/8 px-3 py-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.07em] text-gold-dark">
              Bulk discounts at 10+ &amp; 50+ boxes
            </span>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAdd}
            className="bg-gold hover:bg-gold-dark text-white font-heading text-[11px] font-bold tracking-[0.05em] uppercase w-full py-2.5 rounded-md transition-all hover:scale-[1.02]"
          >
            Add to Cart{variants.length > 1 ? ` · ${v.size}` : ''}
          </button>

        </div>
      </div>
    </article>
  )
}
