// One-off seed for the two products with fully owner-approved active
// pricing (2026-08-06 pricing discussion): Tesamorelin 10mg's manual
// competitive-market override, and GLOW70's locked override (which also
// requires creating the Product row -- GLOW70 does not exist in the
// catalog today, confirmed by the pricing-catalog audit run ahead of this
// sprint).
//
// Every other product in the RUO price table is deliberately left alone --
// see scripts/import-pricing-catalog.ts for the read-only mapping/
// suggested-pricing pass across the full 119-row catalog. This script only
// ever touches these two specific rows, and never sets inventoryTrackingEnabled
// or a physical stock count (opening quantities are never invented; that's
// a separate, explicit admin action once real counts are available).
import { prisma } from '../lib/prisma'
import { seedProductPricing } from '../lib/pricing/service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const results: Array<Record<string, unknown>> = []

  // ─── Tesamorelin 10mg — manual competitive-market override ──────────────
  const tesamorelin = await prisma.product.findUnique({ where: { slug: 'tesamorelin-10mg' } })
  if (!tesamorelin) {
    results.push({ product: 'Tesamorelin 10mg', skipped: 'no product with slug tesamorelin-10mg found' })
  } else {
    if (!dryRun) {
      await seedProductPricing(tesamorelin.id, {
        supplierCaseCost: 177, // RUO price table formula baseline
        unitsPerCase: 10,
        activeStandardCasePrice: 775,
        // 2026-08-19 update (Professional Access Closure Pass, owner-
        // approved): $700 -> $625, resolving the pricing-hierarchy conflict
        // flagged in docs/PendingOwnerActions.md #27 (the old $700 was only
        // 9.68% off Standard, worse than the 15+ standard-volume tier's
        // $658.75). This seed value is kept in sync with the live
        // production value so a future re-run of this one-off script never
        // regresses the price back to the old, superseded $700.
        activeProCasePrice: 625,
        activeBulkPrice: null, // pending owner direction, per instruction
        activeIndividualVialPrice: 80,
        individualSalesEnabled: false,
        manualPricingOverride: true,
        pricingOverrideReason: 'Manual competitive-market override (2026-08-06) — supersedes the formula-suggested case price ($1,425/$1,004). Individual vial price stored for database completeness only; sales disabled until admin explicitly enables. Professional price corrected 2026-08-19 (owner-approved) from $700 to $625 -- see docs/PendingOwnerActions.md #27 (resolved) and docs/Decisions.md.',
        pricingNotes: 'Not currently sold by individual vial — only Standard and Professional case.',
        sku: null,
      })
    }
    results.push({ product: 'Tesamorelin 10mg', productId: tesamorelin.id, applied: !dryRun })
  }

  // ─── Tesamorelin 5mg — derived from the approved 10mg override ──────────
  // Formula: (10mg active price / 2) + $5, applied independently per
  // column: SPA (700/2)+5=355, Individual (80/2)+5=45 -- both kept exactly
  // as formula-derived. Standard is the one deliberate exception: the
  // formula gives $392.50, but the owner rounded that to the cleaner
  // commercial price of $395 (2026-08-06 correction) -- so this seed writes
  // $395, not $392.50, even though $392.50 is what the formula in this
  // comment would produce. Never the general Retatrutide-based supplier-
  // cost multiplier -- that model doesn't apply here since this is a
  // derived-from-sibling-strength override, not a formula-from-supplier-
  // cost product.
  const tesamorelin5mg = await prisma.product.findUnique({ where: { slug: 'tesamorelin-5mg' } })
  if (!tesamorelin5mg) {
    results.push({ product: 'Tesamorelin 5mg', skipped: 'no product with slug tesamorelin-5mg found' })
  } else {
    if (!dryRun) {
      await seedProductPricing(tesamorelin5mg.id, {
        supplierCaseCost: null, // not a supplier-cost-formula product -- see reason below
        unitsPerCase: 10,
        activeStandardCasePrice: 395, // rounded from the formula-derived 392.50, see comment above
        // 2026-08-19 update (Professional Access Closure Pass, owner-
        // approved): $355 -> $320, same resolution as the 10mg row above
        // (docs/PendingOwnerActions.md #27) -- no longer derived from the
        // 10mg formula since the owner approved this and the 10mg price
        // independently rather than re-deriving one from the other.
        activeProCasePrice: 320,
        activeBulkPrice: null,
        activeIndividualVialPrice: 45,
        individualSalesEnabled: false,
        manualPricingOverride: true,
        pricingOverrideReason: 'Derived from approved Tesamorelin 10mg competitive pricing (2026-08-06). Formula: (10mg active price / 2) + $5 -- Individual (80/2)+5=45 kept as formula-derived. Standard case rounded from the formula-derived $392.50 to the cleaner commercial price of $395 per explicit owner instruction. Individual vial price stored for database completeness only; sales disabled until admin explicitly enables. Professional price corrected 2026-08-19 (owner-approved) from $355 to $320, independently of the original derivation formula -- see docs/PendingOwnerActions.md #27 (resolved) and docs/Decisions.md.',
        pricingNotes: 'Not currently sold by individual vial — only Standard and Professional case. Pricing intentionally derived (Standard commercially rounded), not independently formula-calculated or guessed.',
        sku: null,
      })
      await prisma.adminAuditLog.create({
        data: {
          action: 'SEED_DERIVED_PRICING',
          entity: 'Product',
          entityId: tesamorelin5mg.id,
          adminId: 'system-pricing-seed',
          details: {
            formula: '(Tesamorelin 10mg active price / 2) + 5 (Professional price later owner-corrected independently, 2026-08-19)',
            derivedFrom: 'tesamorelin-10mg',
            activeStandardCasePrice: 392.5,
            activeProCasePrice: 320,
            activeIndividualVialPrice: 45,
          },
        },
      })
    }
    results.push({ product: 'Tesamorelin 5mg', productId: tesamorelin5mg.id, applied: !dryRun })
  }

  // GLOW70's approved, real (non-placeholder) storefront description. Exact
  // composition/technical spec for GLOW70 has not been confirmed in any
  // catalog/pricing source this script has access to -- this deliberately
  // doesn't invent one. Update once real GLOW70-specific composition
  // details are supplied.
  const GLOW70_DESCRIPTION =
    'GLOW70 is a pre-formulated research blend supplied for laboratory research use only. Detailed composition and technical specifications are available on request. Not for human use, consumption, diagnostic use, therapeutic use, or veterinary use.'

  // ─── GLOW70 — locked pricing, product row does not exist yet ────────────
  let glow70 = await prisma.product.findUnique({ where: { slug: 'glow70-70mg' } })
  if (!glow70 && !dryRun) {
    glow70 = await prisma.product.create({
      data: {
        slug: 'glow70-70mg',
        name: 'GLOW70',
        category: 'Combination',
        size: '70mg',
        // Legacy flat-price field (storefront / invoice-item datalist) —
        // set to the approved individual-vial price since individual sales
        // are enabled for this product, matching how every other
        // individual-sale-eligible product's legacy `price` field is used.
        price: 89,
        description: GLOW70_DESCRIPTION,
        imageUrl: '/images/ALL.png', // no GLOW70-specific product photo exists yet
        costOfGoods: 0, // legacy field superseded by supplierCaseCost below for this product
      },
    })
  } else if (glow70 && !dryRun && glow70.description !== GLOW70_DESCRIPTION) {
    // Re-runnable correction: an earlier run of this script wrote a
    // placeholder description ("...carried over from the sibling GLOW50
    // product pattern — flag for owner review...") that was never meant to
    // be customer-visible but was live on the public storefront. Fix it in
    // place rather than leaving a stale row around.
    glow70 = await prisma.product.update({ where: { id: glow70.id }, data: { description: GLOW70_DESCRIPTION } })
  }

  if (!glow70) {
    results.push({ product: 'GLOW70', skipped: dryRun ? 'DRY RUN — product would be created' : 'creation failed' })
  } else {
    if (!dryRun) {
      await seedProductPricing(glow70.id, {
        supplierCaseCost: 186,
        unitsPerCase: 10,
        activeStandardCasePrice: 725,
        activeProCasePrice: 565,
        activeBulkPrice: null,
        activeIndividualVialPrice: 89,
        individualSalesEnabled: true,
        manualPricingOverride: true,
        pricingOverrideReason: 'Locked GLOW70 pricing (2026-08-06 pricing discussion) — do not replace with formula-generated pricing.',
        sku: null,
      })
    }
    results.push({ product: 'GLOW70', productId: glow70.id, created: true, applied: !dryRun })
  }

  // ─── GLOW50 — discontinued by the pharmaceutical lab, GLOW70 is its
  // approved replacement. Deactivated, never deleted: pricingStatus goes to
  // INACTIVE (the storefront query excludes INACTIVE products entirely —
  // not shown in browse/search/pricing table/sitemap once that lands), but
  // the row itself, and any historical invoice/order line items that
  // reference it, are left completely untouched. Confirmed via a one-time
  // read-only check before this was written: zero invoice items and zero
  // order items currently reference GLOW50, so this has no historical-data
  // impact today.
  const glow50 = await prisma.product.findUnique({ where: { slug: 'glow50-50mg' } })
  if (!glow50) {
    results.push({ product: 'GLOW50', skipped: 'no product with slug glow50-50mg found' })
  } else if (glow50.pricingStatus === 'INACTIVE') {
    results.push({ product: 'GLOW50', productId: glow50.id, alreadyInactive: true })
  } else {
    if (!dryRun) {
      await prisma.product.update({ where: { id: glow50.id }, data: { pricingStatus: 'INACTIVE' } })
      await prisma.adminAuditLog.create({
        data: {
          action: 'PRODUCT_DEACTIVATED',
          entity: 'Product',
          entityId: glow50.id,
          adminId: 'system-pricing-seed',
          details: { reason: 'GLOW50 discontinued by the pharmaceutical lab; GLOW70 is the approved replacement.', productName: 'GLOW50' },
        },
      })
    }
    results.push({ product: 'GLOW50', productId: glow50.id, deactivated: !dryRun })
  }

  console.log(JSON.stringify({ mode: dryRun ? 'DRY RUN — no writes made' : 'APPLIED', results }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
