import { describe, it, expect } from 'vitest'
import { MERCHANDISING_TAXONOMY, getMerchandisingCategory, categoriesForProductName } from './merchandisingTaxonomy'

describe('merchandisingTaxonomy', () => {
  it('every category has a unique slug', () => {
    const slugs = MERCHANDISING_TAXONOMY.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('GLP-1 family includes all three core products', () => {
    const category = getMerchandisingCategory('glp-1-weight-management')
    expect(category?.productNames).toEqual(expect.arrayContaining(['Semaglutide', 'Tirzepatide', 'Retatrutide']))
  })

  it('getMerchandisingCategory returns undefined for an unknown slug', () => {
    expect(getMerchandisingCategory('not-a-real-slug')).toBeUndefined()
  })

  it('a product can belong to more than one category (NAD+)', () => {
    const categories = categoriesForProductName('NAD+')
    expect(categories.length).toBeGreaterThan(1)
    expect(categories.map((c) => c.slug)).toEqual(expect.arrayContaining(['anti-aging-longevity', 'immune-cellular-defense']))
  })

  it('a product with no taxonomy membership returns an empty array, not undefined', () => {
    expect(categoriesForProductName('Not A Real Product')).toEqual([])
  })

  it('blends-stacks lists the active GLOW70 and does not list discontinued/false-identity names', () => {
    const blends = getMerchandisingCategory('blends-stacks')
    expect(blends?.productNames).toContain('GLOW70')
    // GLOW50 (discontinued 2026-08-17) and the legacy pre-rebrand GLOW70
    // name must never reappear here -- see the productNames comment in
    // merchandisingTaxonomy.ts for why.
    expect(blends?.productNames).not.toContain('GLOW50')
    expect(blends?.productNames).not.toContain('BPC 10mg + GHK-Cu 50mg + TB500 10mg')
  })
})
