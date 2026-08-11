import { describe, it, expect } from 'vitest'
import { resolveProductImage, PRODUCT_FALLBACK_IMAGE } from './productImages'

describe('resolveProductImage', () => {
  it('returns the curated map entry when the product name is known', () => {
    expect(resolveProductImage('Semaglutide', 'https://example.com/whatever.png')).toBe('/images/Semaglutide.png')
  })

  it('returns a local dbUrl unchanged for an unmapped product', () => {
    expect(resolveProductImage('Unmapped Product', '/images/products/foo.png')).toBe('/images/products/foo.png')
  })

  it('returns an allowed remote host unchanged', () => {
    expect(resolveProductImage('Unmapped Product', 'https://files.stripe.com/x.png')).toBe('https://files.stripe.com/x.png')
    expect(resolveProductImage('Unmapped Product', 'https://abc123.supabase.co/storage/x.png')).toBe(
      'https://abc123.supabase.co/storage/x.png'
    )
  })

  // Regression test for a real production incident: two leftover test-data
  // rows with an unconfigured `https://example.com/...` imageUrl 500'd the
  // live homepage for every visitor, because this function had no reason to
  // distrust a non-empty dbUrl before passing it straight to next/image,
  // which throws synchronously (crashing the whole page, not just the
  // image) for any host outside next.config.ts's remotePatterns.
  it('falls back to the safe placeholder for a host not in next.config.ts remotePatterns', () => {
    expect(resolveProductImage('Unmapped Product', 'https://example.com/rehearsal.png')).toBe(PRODUCT_FALLBACK_IMAGE)
  })

  it('falls back to the safe placeholder for a non-https URL', () => {
    expect(resolveProductImage('Unmapped Product', 'http://files.stripe.com/x.png')).toBe(PRODUCT_FALLBACK_IMAGE)
  })

  it('falls back to the safe placeholder for a malformed URL', () => {
    expect(resolveProductImage('Unmapped Product', 'not a url')).toBe(PRODUCT_FALLBACK_IMAGE)
  })

  it('falls back to the safe placeholder for null/undefined dbUrl', () => {
    expect(resolveProductImage('Unmapped Product', null)).toBe(PRODUCT_FALLBACK_IMAGE)
    expect(resolveProductImage('Unmapped Product', undefined)).toBe(PRODUCT_FALLBACK_IMAGE)
  })

  it('falls back to the safe placeholder for a lineup image on an individual product', () => {
    expect(resolveProductImage('Unmapped Product', '/images/ALL.png')).toBe(PRODUCT_FALLBACK_IMAGE)
  })
})
