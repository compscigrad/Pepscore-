// Shared product-image resolution — used by both the homepage catalog grid
// and individual product detail pages, so there's exactly one image map to
// keep in sync rather than two copies drifting apart.
export const PRODUCT_FALLBACK_IMAGE = '/images/products/default-single-vial.png'

// Images that must NOT appear on individual product surfaces (cards or
// detail pages) -- these are lineup/hero shots, not single-product photos.
export const LINEUP_IMAGES = new Set(['/images/ALL.png', '/images/hero-vials.jpeg'])

// Full product name → single-vial image mapping.
// Sources: existing product photos + ZIP pepscore_single_vial_images.zip
export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  // Existing hero-quality product photos
  'Semaglutide':       '/images/Semaglutide.png',
  'Tirzepatide':       '/images/Tirzepatide.png',
  'Retatrutide':       '/images/Retatrutide.png',
  'NAD+':              '/images/nad.png',
  'Epithalon':         '/images/epithalon.png',

  // From pepscore_single_vial_images.zip → public/images/products/
  'GHK-Cu':                                        '/images/products/ghk-cu.png',
  'KissPeptin-10':                                 '/images/products/kisspeptin-10.png',
  'BPC 157':                                       '/images/products/bpc-157.png',
  'TB500':                                         '/images/products/tb500.png',
  'KPV (Lysine-Proline-Valine)':                   '/images/products/kpv.png',
  'LL37':                                          '/images/products/ll37.png',
  'MOTS-c':                                        '/images/products/mots-c.png',
  'Thymosin Alpha-1':                              '/images/products/thymosin-alpha-1.png',
  'Thymalin':                                      '/images/products/thymalin.png',
  'Tesamorelin':                                   '/images/products/tesamorelin.png',
  'AOD 9604':                                      '/images/products/aod-9604.png',
  'SLU-PP-332':                                    '/images/products/slu-pp-332.png',
  'SS-31':                                         '/images/products/ss-31.png',
  'Humanin':                                       '/images/products/humanin.png',
  'Pinealon':                                      '/images/products/pinealon.png',
  'PT-141':                                        '/images/products/pt-141.png',
  'HCG':                                           '/images/products/hcg.png',
  'HMG':                                           '/images/products/hmg.png',
  'Oxytocin':                                      '/images/products/oxytocin.png',
  'Ipamorelin':                                    '/images/products/ipamorelin.png',
  'Sermorelin Acetate':                            '/images/products/sermorelin-acetate.png',
  'CJC-1295 With DAC':                             '/images/products/cjc-1295-with-dac.png',
  'CJC-1295 No DAC':                               '/images/products/cjc-1295-no-dac.png',
  'CJC-1295 without DAC 5mg + Ipamorelin 5mg':     '/images/products/cjc-1295-no-dac.png',
  'IGF-ILR3':                                      '/images/products/igf-1-lr3.png',
  'IGF-DES':                                       '/images/products/igf-des.png',
  'GHRP-6 Acetate':                                '/images/products/ghrp-6-acetate.png',
  'Semax':                                         '/images/products/semax.png',
  'Selank':                                        '/images/products/selank.png',
  'DSIP':                                          '/images/products/dsip.png',
  'Snap-8':                                        '/images/products/snap-8.png',
  'MT-2':                                          '/images/products/mt-2.png',
  'MT1':                                           '/images/products/mt1-5mg.png',
  'Dermorphin':                                    '/images/products/dermorphin.png',
  'Lemon Bottle':                                  '/images/products/lemon-bottle.png',
  'BAC Water':                                     '/images/products/bac-water.png',
  'GA = AA Water':                                 '/images/products/ga-aa-water.png',
  'Botulinum Toxin':                               '/images/products/botulinum-toxin.png',
  'VIP5':                                          '/images/products/vip5.png',
  'VIP10':                                         '/images/products/vip10.png',
  'EPO 3000IU':                                    '/images/products/epo3000iu.png',
  'LC120':                                         '/images/products/lc120-10ml.png',
  'LC216':                                         '/images/products/lc216-10ml.png',
  '5-Amino-1MQ':                                   '/images/products/5-amino-1mq.png',
  'B12 1mg/ml':                                    '/images/products/b12-1mg-ml-10ml.png',
  'PNC 27':                                        '/images/products/pnc-27.png',
  'Survodutide':                                   '/images/products/survodutide.png',
  'Ara-290':                                       '/images/products/ara-290.png',
  'G610':                                          '/images/products/g610.png',
}

export function resolveProductImage(name: string, dbUrl: string | null | undefined): string {
  if (PRODUCT_IMAGE_MAP[name]) return PRODUCT_IMAGE_MAP[name]
  if (dbUrl && !LINEUP_IMAGES.has(dbUrl)) return dbUrl
  return PRODUCT_FALLBACK_IMAGE
}
