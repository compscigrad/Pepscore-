'use client'

import { useState } from 'react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'

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

      {/* Image */}
      <div className="bg-gradient-to-br from-cream to-[#F5EFE0] h-[230px] flex items-center justify-center p-5">
        <div className="relative h-[170px] w-full">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-[1.07] group-hover:-translate-y-1"
            loading="lazy"
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-[18px] flex flex-col flex-1">
        <p className="font-heading text-[10px] font-bold tracking-[0.12em] uppercase text-gold mb-1">{category}</p>
        <h3 className="font-heading text-[17px] font-bold text-dark leading-tight mb-2">{name}</h3>
        <p className="text-[12px] text-g700 leading-relaxed mb-3">{description}</p>

        {/* Size selector — only shown when multiple variants exist */}
        {variants.length > 1 && (
          <div className="mb-3">
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
        <div className="bg-[#FDFAF5] border border-gold/15 rounded-lg p-3 mb-3">
          <div className="grid grid-cols-3 text-center divide-x divide-gold/15">
            <div className="px-1">
              <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">1 box</p>
              <p className="font-heading text-[15px] font-extrabold text-dark">${v.price}</p>
            </div>
            <div className="px-1">
              <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">10 boxes</p>
              <p className="font-heading text-[15px] font-extrabold text-gold">${v.bulkPrice5}</p>
            </div>
            <div className="px-1">
              <p className="text-[9px] font-bold text-g500 uppercase tracking-[0.07em] mb-0.5">50 boxes</p>
              <p className="font-heading text-[15px] font-extrabold text-gold">${v.bulkPrice10}</p>
            </div>
          </div>
          <p className="text-[9px] text-g500 text-center mt-2 leading-tight">
            Bulk pricing discounts reflected at 10-box and 50-box quantities.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={handleAdd}
          className="mt-auto bg-gold hover:bg-gold-dark text-white font-heading text-[11px] font-bold tracking-[0.05em] uppercase w-full py-2.5 rounded-md transition-all hover:scale-[1.02]"
        >
          Add to Cart{variants.length > 1 ? ` · ${v.size}` : ' · For Research Only'}
        </button>
      </div>
    </article>
  )
}
