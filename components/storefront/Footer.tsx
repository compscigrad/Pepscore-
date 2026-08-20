// Site footer with RUO disclaimer, product links, contact info
import Link from 'next/link'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'
import { FirstOrderOfferModal } from './FirstOrderOfferModal'
import { ScientificBackground } from './ScientificBackground'
import { BrandLockup } from './BrandLockup'
import { getActiveFirstOrderOffer } from '@/lib/promotions/firstOrderOffer'
import { formatDiscountLabel } from '@/lib/promotions/format'

import { prisma } from '@/lib/prisma'
import { groupByName } from '@/lib/storefront/groupByName'

// Footer "Products" list -- display label plus the canonical Product.name
// each resolves against (2026-08-15 deep-link fix). Labels stay exactly as
// previously shown; "CJC-1295 / Ipamorelin" is the existing category
// shorthand for the specific combo product "CJC-1295 without DAC 5mg +
// Ipamorelin 5mg" (lib/storefront/merchandisingTaxonomy.ts lists it as the
// first CJC-family entry after plain Ipamorelin), not the whole CJC-1295
// family -- flagged here since it's the one non-exact name match.
const FOOTER_PRODUCTS = [
  { label: 'Semaglutide', name: 'Semaglutide' },
  { label: 'Tirzepatide', name: 'Tirzepatide' },
  { label: 'Retatrutide', name: 'Retatrutide' },
  { label: 'NAD+', name: 'NAD+' },
  { label: 'Epithalon', name: 'Epithalon' },
  { label: 'CJC-1295 / Ipamorelin', name: 'CJC-1295 without DAC 5mg + Ipamorelin 5mg' },
  { label: 'Glutathione', name: 'Glutathione' },
  { label: 'GHK-Cu', name: 'GHK-Cu' },
  { label: 'PT-141', name: 'PT-141' },
] as const

// Resolves each footer product to the same canonical slug its own
// homepage/search/category card would land on by default (variants[0] of
// groupByName's grouping, same query shape as the homepage's getProducts())
// -- one source of truth, not a second hard-coded routing map. Falls back
// to the generic catalog anchor only if a name is ever renamed/removed, so
// a stale footer entry degrades instead of 404ing.
async function getFooterProductSlugs(): Promise<Map<string, string>> {
  const rows = await prisma.product.findMany({
    where: { name: { in: FOOTER_PRODUCTS.map((p) => p.name) }, pricingStatus: { not: 'INACTIVE' } },
    orderBy: { createdAt: 'asc' },
  })
  const grouped = groupByName(rows)
  const map = new Map<string, string>()
  for (const p of grouped) {
    if (p.variants[0]) map.set(p.name, p.variants[0].slug)
  }
  return map
}

// Server Component -- reads the active first-order offer directly (no
// client fetch) so the banner renders or doesn't with zero flash, and
// stays entirely absent from the DOM while the offer is off (the
// default). Copy comes from the active campaign's own publicTitle rather
// than being constructed from a raw percentage, so a fixed-dollar
// campaign (or any future copy an admin writes) renders correctly without
// a code change.
export async function Footer() {
  const [offer, footerSlugs] = await Promise.all([getActiveFirstOrderOffer(), getFooterProductSlugs()])

  return (
    <footer className="relative overflow-hidden bg-black text-white pt-14 pb-7 px-6">
      {/* Final, very subtle scientific watermark -- the page's last beat
          of the DNA/molecular system rather than an abrupt return to
          plain black. Confined and heavily faded so every footer link
          stays fully readable. */}
      <ScientificBackground intensity="medium" position="object-right-bottom" zoom={1.5} fadeLeft fadeTop />
      <div className="max-w-[1200px] mx-auto relative">

        {offer.live && offer.campaign && (
          <div className="mb-11 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-transparent p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-heading text-[17px] font-bold text-white mb-1">{offer.campaign.publicTitle}</p>
              <p className="text-[13px] text-white/55">
                {offer.campaign.publicDescription ?? 'Leave your email and phone number to claim your first-order discount.'}
              </p>
            </div>
            <FirstOrderOfferModal
              campaignId={offer.campaign.id}
              publicTitle={offer.campaign.publicTitle}
              discountType={offer.campaign.discountType}
              discountValue={offer.campaign.discountValue}
              triggerLabel={`Claim ${formatDiscountLabel(offer.campaign.discountType, offer.campaign.discountValue)} →`}
              triggerClassName="shrink-0 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-full transition-all"
            />
          </div>
        )}

        {/* ── Closing brand signature (2026-08-13) ────────────────────────────
            A hero-scale reprise of the navbar's PEPSCORE/LAB lockup (same
            BrandLockup component, size="footerLarge") directly above the
            tagline -- the page's final, dominant brand moment, distinct
            from the small inline wordmark the brand column used to carry
            (removed below so this doesn't read as two competing logos). */}
        <div className="flex flex-col items-center text-center pb-11 border-b border-[#D4AF37]/15">
          <BrandLockup size="footerLarge" />
          {/* max-w widens at lg+ (2026-08-14) -- below lg this is
              unchanged from before (560px, which doesn't even bind until
              the viewport itself exceeds it) so mobile/tablet composition
              is untouched. At desktop, the wordmark's own centered box is
              only as wide as PEPSCORE's text (~357px), narrower than the
              P's reach further left -- capping the tagline at that same
              560px kept its left edge short of the P instead of the
              "recreate the mobile balance" feel of visibly outspanning the
              whole lockup. 680px was measured (not guessed) as the
              narrowest width whose centered left edge reaches the P's own
              left edge across 1024-1600px, since the P-to-wordmark-center
              distance is constant regardless of viewport. */}
          <p className="text-[14px] sm:text-[15px] text-white/55 leading-relaxed max-w-[560px] lg:max-w-[680px] mt-6">
            Precision-grade research peptides for laboratories that refuse to compromise on quality or consistency.
          </p>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-11 py-11 border-b border-[#D4AF37]/15">

          {/* Brand column -- the logo itself now lives in the large closing
              signature above; this column carries the compliance/CTA
              content that belongs at the same level as Products/
              Information/Contact. */}
          <div>
            {/* RUO disclaimer box */}
            <div className="text-[11px] text-white/35 leading-relaxed border border-white/10 p-3 rounded-md mb-4">
              ⚠️ All Pepscore Lab products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Must be handled by qualified researchers in appropriate laboratory environments.
            </div>
            <LeadCaptureTrigger
              interestType="GENERAL_UPDATES"
              modalTitle="Get Updates"
              modalDescription="Leave your email and we'll keep you posted on new products, restocks, and pricing."
              triggerLabel="Get Updates →"
              triggerClassName="text-[12px] font-heading font-bold tracking-[0.06em] uppercase text-[#D4AF37] hover:text-[#E8C84A] transition-colors"
            />
          </div>

          {/* Products */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-[#D4AF37] mb-3">Products</h4>
            <ul className="space-y-2">
              {FOOTER_PRODUCTS.map(({ label, name }) => {
                const slug = footerSlugs.get(name)
                const href = slug ? `/products/${slug}` : '/#products'
                return (
                  <li key={label}>
                    <Link href={href} className="text-[13px] text-white/60 hover:text-[#D4AF37] transition-colors">
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Information -- every link below now has a real destination
              (docs/PendingOwnerActions.md tracks the owner/legal review
              still needed on the drafted policy content itself). */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-[#D4AF37] mb-3">Information</h4>
            <ul className="space-y-2">
              {([
                ['Lab Results / COAs', '/lab-results'],
                ['Bulk Pricing', '/#bulk'],
                ['Shipping Policy', '/shipping'],
                ['Returns & Refunds', '/returns'],
                ['Terms of Service', '/terms'],
                ['Privacy Policy', '/privacy'],
              ] as const).map(([label, href]) => (
                <li key={label}>
                  {href ? (
                    <Link href={href} className="text-[13px] text-white/60 hover:text-[#D4AF37] transition-colors">
                      {label}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-white/30 cursor-default" title="Coming soon">
                      {label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-[#D4AF37] mb-3">Contact</h4>
            <div className="space-y-3">
              <div className="flex gap-2 items-start">
                <span className="text-[15px] mt-0.5">✉️</span>
                <a href="mailto:contact@pepscorelab.com" className="text-[13px] text-white/60 hover:text-[#D4AF37] transition-colors">
                  contact@pepscorelab.com
                </a>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-[15px] mt-0.5">📍</span>
                <span className="text-[13px] text-white/60">United States</span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-[15px] mt-0.5">🕐</span>
                <span className="text-[13px] text-white/60">Mon–Fri, 9AM–5PM EST</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <Link
                href="/#products"
                className="inline-block bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 rounded-full transition-all"
              >
                Order Now
              </Link>
              {/* Price Match Guarantee (2026-08-20 Price Match sprint) --
                  a dedicated structured request page (product, competitor,
                  delivered price, proof), not the generic lead-capture
                  modal this link used before. Still creates a real
                  LeadCapture row (interestType PRICE_MATCH_REQUEST) for
                  admin-CRM visibility, plus the actual PriceMatchRequest
                  review-queue record the modal never had. */}
              <Link
                href="/price-match"
                className="text-[12px] font-heading font-bold text-white/50 hover:text-[#D4AF37] underline underline-offset-2 transition-colors"
              >
                Request a Price Match
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-wrap justify-between items-center gap-3">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} Pepscore Lab — Research Peptides. All rights reserved. For research purposes only.
          </p>
          <div className="flex gap-5 items-center">
            {([
              ['Privacy', '/privacy'],
              ['Terms', '/terms'],
              ['COAs', '/lab-results'],
            ] as const).map(([label, href]) => (
              <Link key={label} href={href} className="text-[12px] text-white/25 hover:text-white/50 transition-colors">
                {label}
              </Link>
            ))}
            {/* Discreet, staff-only entry point -- deliberately understated
                relative to the customer-facing "Customer Sign In" header
                CTA, never removed/hidden, real server-side authorization
                (lib/isAdmin.ts) still gates /admin regardless of who
                clicks this. */}
            <Link href="/sign-in?redirect_url=/admin" className="text-[12px] text-white/25 hover:text-white/50 transition-colors">
              Admin Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
