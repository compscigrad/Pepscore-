// Shared product-image resolution — used by both the homepage catalog grid
// and individual product detail pages, so there's exactly one image map to
// keep in sync rather than two copies drifting apart.
export const PRODUCT_FALLBACK_IMAGE = '/images/products/default-single-vial.png'

// Images that must NOT appear on individual product surfaces (cards or
// detail pages) -- these are lineup/hero shots, not single-product photos.
export const LINEUP_IMAGES = new Set(['/images/ALL.png', '/images/hero-vials.jpeg'])

// Full product name -> FAMILY storefront image mapping (2026-08-26 CLEAN
// PROFESSIONAL V2 approved asset import, superseding the 2026-08-17 batch).
// Source of truth: Pepscore_66_3D_Family_Images_APPROVED.zip (complete
// 66-family library) and Pepscore_3D_Storefront_ACTIVE_50_CLEAN_PROFESSIONAL_V2.zip
// (the 50-currently-active subset, bundled with a variant-mapping JSON),
// preserved at the owner's canonical "Pepscore Lab Live" asset folder and
// docs/assets/manifests/approved-storefront-family-manifest-2026-08-26.json.
// 66 approved family images live at public/images/products/families/ -- the
// prior 64-image batch was relocated, not deleted, to
// public/images/products/families-superseded-2026-08-17-approved-corrected/.
// Sibling strengths of the same family intentionally share one file (e.g.
// every Semaglutide row below points at the same Semaglutide.png); this is
// photography at the FAMILY level, never per-strength, and none of these
// images have mg/strength text on them by design.
//
// Every one of the 68 live distinct product names now resolves to one of
// the 66 files below -- 'GLOW50' (previously unmapped; no replacement image
// existed in the 2026-08-17 batch) now has a real approved image and was
// added. HGH/SLU-PP-332/Botulinum Toxin Type A keep real image entries
// despite being pricingStatus:INACTIVE today (verified directly against
// the live Product table 2026-08-26) -- consistent with this map's existing
// design: it is a pure name->image lookup, never itself a visibility gate,
// so an archived product having a resolvable image here creates no
// storefront-exposure risk (that gate is Product.pricingStatus, enforced
// entirely elsewhere). NOTE: the approved batch's own bundled JSON flags
// HGH and SLU-PP-332 as "activeStorefront: true" -- that is WRONG relative
// to the live database and was NOT trusted; only the direct DB read above
// was used to write this comment.
//
// GLOW70 canonicalization (owner-approved, final, carried forward
// unchanged from the 2026-08-17 decision): the legacy DB record named
// 'BPC 10mg + GHK-Cu 50mg + TB500 10mg' (archived, slug bpc-ghk-tb-70mg) is
// the SAME physical blend as GLOW70, just recorded under its old
// spelled-out name before the GLOW70 brand name existed. Both entries
// below point at GLOW70.png. The new approved batch separately includes an
// inactive "BPC 157 + GHK-Cu + TB500.png" family image -- deliberately NOT
// used for this DB row, so as not to silently reopen a prior, reasoned,
// owner-approved consolidation without an explicit new instruction to do
// so. The underlying database records were NOT merged/deleted.
//
// Filenames use " and " rather than " + " as a join word (BPC 157 and
// TB500.png, BPC 157 and GHK-Cu and TB500.png, CJC-1295 and
// Ipamorelin.png, Cagrilintide and Semaglutide.png) -- a real bug found
// 2026-08-17: next/image's optimizer silently fails (naturalWidth 0, no
// console error) for a static path containing " + " with spaces on both
// sides, even though the raw static file serves fine at the same URL.
// 'NAD+.png' is unaffected (no surrounding spaces around its '+'),
// confirming the trigger is specifically a space-plus-space sequence, not
// the character alone. The 4 affected files in this new batch were renamed
// on import rather than trying to patch encoding at every call site.
export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  '5-Amino-1MQ': '/images/products/families/5-Amino-1MQ.png',
  'AOD 9604': '/images/products/families/AOD 9604.png',
  'Ara-290': '/images/products/families/Ara-290.png',
  'B12 1mg/ml': '/images/products/families/B12.png',
  'BAC Water': '/images/products/families/BAC Water.png',
  'BPC 10mg + GHK-Cu 50mg + TB500 10mg': '/images/products/families/GLOW70.png',
  'BPC 157': '/images/products/families/BPC 157.png',
  'BPC10 + TB10': '/images/products/families/BPC 157 and TB500.png',
  'BPC5 + TB5': '/images/products/families/BPC 157 and TB500.png',
  'Botulinum Toxin Type A': '/images/products/families/Botulinum Toxin Type A.png',
  'CJC-1295 No DAC': '/images/products/families/CJC-1295 No DAC.png',
  'CJC-1295 With DAC': '/images/products/families/CJC-1295 With DAC.png',
  'CJC-1295 without DAC 5mg + Ipamorelin 5mg': '/images/products/families/CJC-1295 and Ipamorelin.png',
  'Cagrilintide': '/images/products/families/Cagrilintide.png',
  'Cagrilintide 2.5mg + Semaglutide 2.5mg': '/images/products/families/Cagrilintide and Semaglutide.png',
  'Cagrilintide 5mg + Semaglutide 5mg': '/images/products/families/Cagrilintide and Semaglutide.png',
  'Cerebrolysin (6 vials)': '/images/products/families/Cerebrolysin.png',
  'DSIP': '/images/products/families/DSIP.png',
  'Dermorphin': '/images/products/families/Dermorphin.png',
  'EPO 3000IU': '/images/products/families/EPO.png',
  'Epithalon': '/images/products/families/Epithalon.png',
  'G610': '/images/products/families/G610.png',
  'GA = AA Water': '/images/products/families/GA = AA Water.png',
  'GHK-Cu': '/images/products/families/GHK-Cu.png',
  'GHRP-6 Acetate': '/images/products/families/GHRP-6 Acetate.png',
  'GLOW50': '/images/products/families/GLOW50.png',
  'GLOW70': '/images/products/families/GLOW70.png',
  'Glutathione': '/images/products/families/Glutathione.png',
  'HCG': '/images/products/families/HCG.png',
  'HGH': '/images/products/families/HGH.png',
  'HMG': '/images/products/families/HMG.png',
  'Humanin': '/images/products/families/Humanin.png',
  'IGF-DES': '/images/products/families/IGF-DES.png',
  'IGF-ILR3': '/images/products/families/IGF-ILR3.png',
  'Ipamorelin': '/images/products/families/Ipamorelin.png',
  'KLOW': '/images/products/families/KLOW.png',
  'KPV (Lysine-Proline-Valine)': '/images/products/families/KPV (Lysine-Proline-Valine).png',
  'KissPeptin-10': '/images/products/families/KissPeptin-10.png',
  'LC Custom Ingredients': '/images/products/families/LC Custom Ingredients.png',
  'LC120': '/images/products/families/LC120.png',
  'LC216': '/images/products/families/LC216.png',
  'LL37': '/images/products/families/LL37.png',
  'Lemon Bottle': '/images/products/families/Lemon Bottle.png',
  'MOTS-c': '/images/products/families/MOTS-c.png',
  'MT-2': '/images/products/families/MT-2.png',
  'MT1': '/images/products/families/MT1.png',
  'Mazdutide': '/images/products/families/Mazdutide.png',
  'NAD+': '/images/products/families/NAD+.png',
  'Oxytocin': '/images/products/families/Oxytocin.png',
  'PNC 27': '/images/products/families/PNC 27.png',
  'PT-141': '/images/products/families/PT-141.png',
  'Pinealon': '/images/products/families/Pinealon.png',
  'Retatrutide': '/images/products/families/Retatrutide.png',
  'SLU-PP-332': '/images/products/families/SLU-PP-332.png',
  'SS-31': '/images/products/families/SS-31.png',
  'Selank': '/images/products/families/Selank.png',
  'Semaglutide': '/images/products/families/Semaglutide.png',
  'Semax': '/images/products/families/Semax.png',
  'Sermorelin Acetate': '/images/products/families/Sermorelin Acetate.png',
  'Snap-8': '/images/products/families/Snap-8.png',
  'Survodutide': '/images/products/families/Survodutide.png',
  'TB500': '/images/products/families/TB500.png',
  'Tesamorelin': '/images/products/families/Tesamorelin.png',
  'Thymalin': '/images/products/families/Thymalin.png',
  'Thymosin Alpha-1': '/images/products/families/Thymosin Alpha-1.png',
  'Tirzepatide': '/images/products/families/Tirzepatide.png',
  'VIP10': '/images/products/families/VIP10.png',
  'VIP5': '/images/products/families/VIP5.png',
}

// Must mirror next.config.ts's images.remotePatterns exactly. next/image
// throws synchronously (crashing the entire page render, not just that one
// image) for any src whose host isn't in that allowlist -- discovered via a
// real incident where two leftover test-data rows with an unconfigured
// `https://example.com/...` imageUrl 500'd the live production homepage for
// every visitor, since resolveProductImage() had no reason to distrust a
// non-empty dbUrl. A local `/...`-rooted path never needs remotePatterns
// (Next only enforces the allowlist for absolute remote URLs), so those are
// always safe.
const ALLOWED_REMOTE_IMAGE_HOSTS = [/^files\.stripe\.com$/, /\.supabase\.co$/]

function isSafeProductImageUrl(url: string): boolean {
  if (url.startsWith('/')) return true
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && ALLOWED_REMOTE_IMAGE_HOSTS.some((p) => p.test(hostname))
  } catch {
    return false
  }
}

export function resolveProductImage(name: string, dbUrl: string | null | undefined): string {
  if (PRODUCT_IMAGE_MAP[name]) return PRODUCT_IMAGE_MAP[name]
  if (dbUrl && !LINEUP_IMAGES.has(dbUrl) && isSafeProductImageUrl(dbUrl)) return dbUrl
  return PRODUCT_FALLBACK_IMAGE
}
