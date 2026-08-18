import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { NAV_ITEMS } from './navItems'

// Homepage sections live directly in app/page.tsx, except Contact, which
// is a separate component app/page.tsx renders. Reading both as text
// (rather than rendering) keeps this test dependency-free and fast, and
// it's exactly what would have caught the 2026-08-18 mobile-nav bug's
// sibling risk: a hash href surviving a section id rename.
const HOMEPAGE_SOURCES = [
  path.resolve(__dirname, '../../app/page.tsx'),
  path.resolve(__dirname, '../../components/storefront/ContactSection.tsx'),
]

function homepageSectionIds(): Set<string> {
  const ids = new Set<string>()
  for (const file of HOMEPAGE_SOURCES) {
    const src = fs.readFileSync(file, 'utf8')
    for (const match of src.matchAll(/\bid="([a-zA-Z0-9-]+)"/g)) ids.add(match[1])
  }
  return ids
}

describe('NAV_ITEMS', () => {
  it('has no duplicate labels or hrefs', () => {
    const labels = NAV_ITEMS.map(([label]) => label)
    const hrefs = NAV_ITEMS.map(([, href]) => href)
    expect(new Set(labels).size).toBe(labels.length)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('every homepage-hash href points at a section id that actually exists', () => {
    const ids = homepageSectionIds()
    const hashItems = NAV_ITEMS.filter(([, href]) => href.startsWith('/#'))
    expect(hashItems.length).toBeGreaterThan(0)
    for (const [label, href] of hashItems) {
      const id = href.slice(2)
      expect(ids.has(id), `"${label}" -> ${href}: no element with id="${id}" found on the homepage`).toBe(true)
    }
  })

  it('non-hash hrefs are real routes, not homepage anchors', () => {
    const routeItems = NAV_ITEMS.filter(([, href]) => !href.startsWith('/#'))
    for (const [, href] of routeItems) {
      expect(href.startsWith('/')).toBe(true)
      expect(href.includes('#')).toBe(false)
    }
  })
})
