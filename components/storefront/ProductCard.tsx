// Individual product card used in the product grid
'use client'

import Image from 'next/image'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'

interface ProductCardProps {
  id: string
  slug: string
  name: string
  category: string
  size: string
  price: number
  description: string
  imageUrl: string
  badge: string | null
}

export function ProductCard({
  id, slug, name, category, size, price, description, imageUrl, badge,
}: ProductCardProps) {
  const { addItem, openCart } = useCartStore()

  function handleAdd() {
    addItem({ id, slug, name, size, price, imageUrl })
    toast.success(`${name} added to cart`)
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
        <h3 className="font-heading text-[17px] font-bold text-dark leading-tight mb-0.5">{name}</h3>
        <p className="text-[12px] text-g500 mb-2">{size} · For Research Only</p>
        <p className="text-[13px] text-g700 leading-relaxed flex-1">{description}</p>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3.5 mt-auto border-t border-g100">
          <div>
            <span className="font-heading text-[21px] font-extrabold text-dark">${price.toFixed(2)}</span>
            <span className="block text-[10px] font-medium text-gold tracking-[0.05em]">Bulk discounts available</span>
          </div>
          <button
            onClick={handleAdd}
            className="bg-gold hover:bg-gold-dark text-white font-heading text-[11px] font-bold tracking-[0.05em] uppercase px-4 py-2.5 rounded-md transition-all hover:scale-[1.04]"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  )
}
