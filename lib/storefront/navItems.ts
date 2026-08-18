// Single source of truth for the primary nav's items (2026-08-18
// mobile-nav bugfix) -- Header.tsx's desktop <ul> and mobile dropdown used
// to each hard-code their own copy of this exact list. Identical today,
// but nothing enforced that: a future edit to one without the other would
// silently make one surface's links stale. One array, mapped over twice.
//
// Hash targets (`/#products` etc.) must match a real `id="..."` on the
// homepage (app/page.tsx, or a component it renders, e.g. ContactSection).
// navItems.test.ts asserts this by reading those source files directly --
// so a renamed section id shows up as a failing test, not a dead link.
export const NAV_ITEMS: readonly [label: string, href: string][] = [
  ['Products', '/#products'],
  ['Categories', '/categories'],
  ['Bulk Orders', '/#bulk'],
  ['Why Us', '/#features'],
  ['Mission', '/#about'],
  ['Contact', '/#contact'],
]
