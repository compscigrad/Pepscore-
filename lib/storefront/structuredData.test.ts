import { describe, it, expect } from 'vitest'
import { websiteSchema, productGroupSchema, productGroupId, productSchema } from './structuredData'

describe('websiteSchema', () => {
  it('includes a SearchAction pointed at the real /search route', () => {
    const schema = websiteSchema()
    expect(schema['@type']).toBe('WebSite')
    expect(schema.potentialAction['@type']).toBe('SearchAction')
    expect(schema.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}')
  })
})

describe('productGroupId', () => {
  it('derives a stable, URL-safe id from the real product name, never fabricated', () => {
    expect(productGroupId('Retatrutide')).toBe('retatrutide')
    expect(productGroupId('CJC-1295 No DAC')).toBe('cjc-1295-no-dac')
    expect(productGroupId('NAD+')).toBe('nad')
  })
})

describe('productGroupSchema', () => {
  it('links only the real active variants passed in, never invents a strength', () => {
    const schema = productGroupSchema({
      name: 'Retatrutide',
      variants: [
        { slug: 'retatrutide-5mg', size: '5mg' },
        { slug: 'retatrutide-10mg', size: '10mg' },
      ],
    })
    expect(schema['@type']).toBe('ProductGroup')
    expect(schema.productGroupID).toBe('retatrutide')
    expect(schema.hasVariant).toHaveLength(2)
    expect(schema.hasVariant[0].name).toBe('Retatrutide 5mg')
    expect(schema.hasVariant[1].url).toContain('/products/retatrutide-10mg')
  })
})

describe('productSchema isVariantOf', () => {
  const base = {
    name: 'Retatrutide',
    size: '10mg',
    slug: 'retatrutide-10mg',
    sku: null,
    description: 'test',
    imageUrl: '/images/test.png',
    price: null,
    availability: 'AVAILABLE' as const,
  }

  it('omits isVariantOf for a genuinely single-strength product', () => {
    const schema = productSchema(base)
    expect(schema.isVariantOf).toBeUndefined()
  })

  it('includes isVariantOf pointing at the correct ProductGroup when siblings exist', () => {
    const schema = productSchema({ ...base, hasSiblingVariants: true })
    expect(schema.isVariantOf).toEqual({ '@type': 'ProductGroup', productGroupID: 'retatrutide' })
  })
})
