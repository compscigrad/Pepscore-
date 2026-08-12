import { describe, it, expect } from 'vitest'
import { applyHomepagePriority } from './homepagePriority'
import type { ProductCardProps } from '@/components/storefront/ProductCard'

function card(name: string): ProductCardProps {
  return {
    name,
    featured: false,
    category: 'Test Category',
    description: '',
    imageUrl: '/images/ALL.png',
    badge: null,
    variants: [],
  }
}

describe('applyHomepagePriority', () => {
  it('moves GLP-1, NAD+, CJC, GLOW70, and Tesamorelin ahead of the rest, in tier order', () => {
    const input = [
      card('GHK-Cu'),
      card('Tesamorelin'),
      card('Epithalon'),
      card('GLOW70'),
      card('NAD+'),
      card('Tirzepatide'),
      card('Semaglutide'),
    ]
    const ordered = applyHomepagePriority(input).map((p) => p.name)
    expect(ordered).toEqual(['Semaglutide', 'Tirzepatide', 'NAD+', 'GLOW70', 'Tesamorelin', 'GHK-Cu', 'Epithalon'])
  })

  it('is a no-op skip for a priority tier with zero matching live products (e.g. Botulinum Toxin)', () => {
    const input = [card('Epithalon'), card('GHK-Cu')]
    expect(applyHomepagePriority(input).map((p) => p.name)).toEqual(['Epithalon', 'GHK-Cu'])
  })

  it('never drops or duplicates a product', () => {
    const input = [card('Semaglutide'), card('NAD+'), card('Epithalon'), card('GHK-Cu')]
    const ordered = applyHomepagePriority(input)
    expect(ordered).toHaveLength(input.length)
    expect(new Set(ordered.map((p) => p.name)).size).toBe(input.length)
  })

  it('matches product names case-insensitively', () => {
    const input = [card('Epithalon'), card('nad+')]
    expect(applyHomepagePriority(input).map((p) => p.name)).toEqual(['nad+', 'Epithalon'])
  })
})
