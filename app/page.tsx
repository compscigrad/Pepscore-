// Storefront home page — preserves all sections from the original static site
// Wraps layout sections and fetches live products from the database

import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { ContactSection } from '@/components/storefront/ContactSection'
import { ProductCard, type ProductCardProps } from '@/components/storefront/ProductCard'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { LeadCaptureTrigger } from '@/components/storefront/LeadCaptureTrigger'
import { CatalogDirectory } from '@/components/storefront/CatalogDirectory'
import { HomeSearchBar } from '@/components/storefront/HomeSearchBar'
import { ScientificBackground } from '@/components/storefront/ScientificBackground'
import { FirstOrderOfferModal } from '@/components/storefront/FirstOrderOfferModal'
import { groupByName } from '@/lib/storefront/groupByName'
import { applyHomepagePriority } from '@/lib/storefront/homepagePriority'
import { getCurrentCustomerProEligible } from '@/lib/storefront/professionalAccess'
import { getActiveFirstOrderOffer } from '@/lib/promotions/firstOrderOffer'
import { getAcquisitionPopupSettings } from '@/lib/promotions/acquisitionPopupSettings'
import { formatDiscountLabel } from '@/lib/promotions/format'
import type { AcquisitionPopupTriggerSettings } from '@/components/storefront/FirstOrderOfferModal'

// Note: resolving the current visitor's SPA eligibility below calls Clerk's
// auth(), which makes this route dynamic (per-request) regardless of this
// export -- required, not accidental: a personalized price can never be
// safely cached in a shared static/ISR page.
export const revalidate = 60

async function getProducts() {
  return prisma.product.findMany({
    // Discontinued products (pricingStatus INACTIVE -- e.g. GLOW50,
    // replaced by GLOW70) are excluded from every customer-facing surface
    // entirely, not just deprioritized. inStock is intentionally NOT
    // filtered here anymore: a temporarily out-of-stock or upcoming
    // product still browses, with ProductCard showing its real
    // availability state (lib/storefront/availability.ts) instead of
    // disappearing from the catalog.
    where: { pricingStatus: { not: 'INACTIVE' } },
    orderBy: { createdAt: 'asc' },
  })
}


export default async function HomePage() {
  // Gracefully fall back to empty array if DB isn't configured yet
  const [rawProducts, proEligible, offer, popupSettings] = await Promise.all([
    getProducts().catch(() => []),
    getCurrentCustomerProEligible(),
    getActiveFirstOrderOffer(),
    getAcquisitionPopupSettings(),
  ])
  const products = applyHomepagePriority(groupByName(rawProducts, { proEligible }))

  // Auto-trigger only fires when BOTH the global popup switch AND this
  // specific campaign have opted in (section 23: an admin can turn the
  // whole popup mechanism off without touching campaign content, or scope
  // it to a specific campaign without a deploy either way) --
  // undefined here means FirstOrderOfferModal behaves exactly as a
  // manual-click-only trigger, same as before this feature existed.
  const autoTrigger: AcquisitionPopupTriggerSettings | undefined =
    popupSettings.enabled && offer.campaign?.popupEnabled
      ? {
          delayMs: popupSettings.delayMs,
          scrollThresholdPercent: popupSettings.scrollThresholdPercent,
          exitIntentEnabled: popupSettings.exitIntentEnabled,
          capturedSuppressDays: popupSettings.capturedSuppressDays,
          dismissedSuppressDays: popupSettings.dismissedSuppressDays,
        }
      : undefined

  return (
    <>
      <CartSidebar />

      {/* Announcement bar */}
      <div className="bg-gradient-to-r from-[#8A6B1A] via-[#D4AF37] to-[#8A6B1A] text-black text-center py-2 px-6 font-heading text-[12px] font-bold tracking-[0.08em] uppercase">
        🔬 Free Shipping on Orders Over $150 &nbsp;|&nbsp; For Research Purposes Only &nbsp;|&nbsp; Lab-Verified Purity ≥98%
      </div>

      <Header />

      <main className="bg-black">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-black py-20 px-6">
          <ScientificBackground intensity="strong" position="object-right" fadeLeft />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 640px 640px at 15% 50%, rgba(212,175,55,0.08) 0%, transparent 65%)' }}
          />
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center relative">
            <div>
              {/* The "Pepscore Lab" eyebrow that used to sit here was
                  removed 2026-08-12 -- redundant with the wordmark already
                  in the header immediately above. The hero now opens
                  directly on the Research Peptides badge. "Holistic" was
                  removed globally (2026-08-15) -- the owner does not want
                  brand language implying personal wellness/health
                  treatment/human-use positioning. */}
              <div className="inline-block bg-[#D4AF37]/10 border border-[#D4AF37]/35 rounded-full px-4 py-1.5 font-heading text-[11px] font-bold tracking-[0.12em] uppercase mb-5 text-[#D4AF37]">
                Research Peptides
              </div>
              <h1 className="font-heading text-[clamp(34px,5vw,54px)] font-extrabold leading-[1.1] text-white mb-5">
                Precision-Grade<br />
                <span className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] bg-clip-text text-transparent">Peptides</span> for<br />
                Serious Research
              </h1>
              <p className="text-[17px] font-light text-white/60 leading-[1.7] mb-9 max-w-[480px]">
                Pepscore Lab supplies pharmaceutical-grade research peptides manufactured to exacting quality standards for research use only and independently verified by third-party laboratories to ≥98% purity. Our catalog spans the compound classes serious research programs rely on — from metabolic regulators to longevity and cognitive research peptides — with an emphasis on lot-to-lot consistency and responsive researcher support.
              </p>
              <div className="flex gap-4 flex-wrap">
                <Link
                  href="#products"
                  className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(212,175,55,0.45)]"
                >
                  Shop All Products
                </Link>
                <Link
                  href="#about"
                  className="border border-white/25 text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-full transition-all hover:bg-white/10 hover:-translate-y-0.5"
                >
                  Our Story
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-9 mt-11 pt-7 border-t border-[#D4AF37]/15 flex-wrap">
                {[['≥98%','Verified Purity'],['8+','Peptide Compounds'],['Bulk','Pricing Available']].map(([v,l]) => (
                  <div key={l}>
                    <h3 className="font-heading text-[26px] font-extrabold bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] bg-clip-text text-transparent">{v}</h3>
                    <p className="text-[12px] text-white/40 m-0">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image -- re-swapped 2026-08-12 (owner-corrected
                newPShero.png, same 1672x941 dimensions as the prior pass so
                no aspect-ratio change is needed). Saved under a new
                versioned filename (pepscore-hero-v2.png, not the previous
                hero-vials-new.png) specifically so this deploy can never be
                served from a stale CDN/browser cache still holding the old
                file's bytes under that same old name. Float animation
                (animate-float, app/globals.css) preserved unchanged --
                this is an asset swap, not a motion change. */}
            <div className="flex justify-center items-center">
              <Image
                src="/images/pepscore-hero-v2.png"
                alt="Pepscore Lab Research Peptide Collection"
                width={1672}
                height={941}
                className="w-full max-w-[620px] h-auto rounded-2xl drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-float"
                priority
              />
            </div>
          </div>
        </section>

        {/* ── First-Order Offer (near-hero) ───────────────────────────────────
            The only other first-order-offer surface is the Footer's, at the
            very bottom of the page -- most visitors browsing products never
            scroll that far. This is the one near-hero placement the site was
            missing entirely. Always sourced from the live PromotionCampaign
            (lib/promotions/firstOrderOffer.ts) -- copy, discount amount, and
            even whether this renders at all update automatically if the
            admin changes or retires the active campaign; nothing here is
            hardcoded. Compact by design (one line + one button) so it reads
            as a confident banner, not a popup ambush. */}
        {offer.live && offer.campaign && (
          <section className="bg-black py-6 px-6 border-y border-[#D4AF37]/15">
            <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-heading text-[15px] font-bold text-white">{offer.campaign.publicTitle}</p>
                <p className="text-[12.5px] text-white/55">
                  {offer.campaign.publicDescription ?? 'Leave your email and phone number to claim your first-order discount.'}
                </p>
              </div>
              <FirstOrderOfferModal
                campaignId={offer.campaign.id}
                publicTitle={offer.campaign.popupHeadline ?? offer.campaign.publicTitle}
                publicDescription={offer.campaign.popupBody ?? offer.campaign.publicDescription}
                discountType={offer.campaign.discountType}
                discountValue={offer.campaign.discountValue}
                triggerLabel={`Claim ${formatDiscountLabel(offer.campaign.discountType, offer.campaign.discountValue)} →`}
                triggerClassName="shrink-0 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-full transition-all"
                autoTrigger={autoTrigger}
              />
            </div>
          </section>
        )}

        {/* ── Catalog Directory ────────────────────────────────────────────── */}
        <CatalogDirectory />

        {/* ── Search ───────────────────────────────────────────────────────── */}
        <HomeSearchBar />

        {/* ── Products ─────────────────────────────────────────────────────── */}
        {/* scroll-mt-[88px] on this and the other anchor-target sections
            below (bulk/features/about/contact) accounts for the sticky
            72px header -- without it, following a nav link like Mission
            scrolled the section's own top edge to y=0, landing its heading
            directly underneath the fixed header (2026-08-13). */}
        <section id="products" className="relative py-24 px-6 bg-black scroll-mt-[88px]">
          {/* Confined to the section's top band (heading area only) --
              molecular-network texture, zoomed and flipped for variety
              against the hero's DNA helix, fading out well before the
              product grid so card readability is never affected. */}
          <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
            <ScientificBackground intensity="medium" position="object-top" zoom={1.6} flip fadeLeft={false} fadeBottom />
          </div>
          <div className="max-w-[1200px] mx-auto relative">
            <div className="text-center mb-14">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Research Catalog</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-3">Premium Research Peptides</h2>
              <p className="text-[16px] font-light text-white/55 max-w-[540px] mx-auto leading-[1.7]">
                Every compound is third-party tested, precisely dosed, and formulated for research excellence.
              </p>
              <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mx-auto mt-3.5 rounded-full" />
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-6">
                {products.map(p => (
                  <ProductCard key={p.name} {...p} />
                ))}
              </div>
            ) : (
              /* Fallback static catalog — shown when DB isn't connected yet */
              <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-6">
                {STATIC_PRODUCTS.map(p => (
                  <ProductCard key={p.name} {...p} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Bulk Section ─────────────────────────────────────────────────── */}
        <section id="bulk" className="relative overflow-hidden py-20 px-6 bg-gradient-to-br from-[#0d0d0d] to-black text-white scroll-mt-[88px]">
          {/* Particle-field motif (the source asset's lower-left wave/dot
              texture, sampled via object-position rather than the DNA
              helix) -- a softer transition beat between the busier
              Products grid above and the Trust cards below. */}
          <ScientificBackground intensity="medium" position="object-left-bottom" zoom={1.8} fadeRight fadeTop />
          <div className="max-w-[1000px] mx-auto relative">
            <div className="text-center mb-11">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37]/70 mb-3 block">Volume Savings</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-3">Bulk Pricing for Researchers</h2>
              <p className="text-[16px] font-light text-white/60 max-w-[540px] mx-auto">Scale your research without scaling your costs.</p>
              <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mx-auto mt-3.5 rounded-full" />
            </div>
            {/* Accurate owner-specified case-quantity discount schedule --
                off the Standard Case price, not individual-vial pricing.
                Informational/marketing copy today; not yet an automatic
                checkout-applied discount (see docs/PendingOwnerActions.md
                if real enforcement is wanted). */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
              {[
                { range: '3–4 cases', save: 'Save 5%', featured: false },
                { range: '5–9 cases', save: 'Save 8%', featured: false },
                { range: '10–14 cases', save: 'Save 10%', featured: false },
                { range: '15+ cases', save: 'Save 15%', featured: true },
              ].map(c => (
                // Dog Tag Titanium card surface (2026-08-15, FINAL
                // selection out of the 4-candidate material comparison --
                // Option C). One flat base, no multi-stop color gradient.
                // Base is a slightly deeper/stronger silver than the two
                // earlier flat attempts (#DADDE0 read as white/pearl,
                // #A8AFB6 alone read as a plain gray card) specifically so
                // the surface registers as metal immediately, per the
                // "dog tag / stamped metal edge" brief. Character comes
                // from a crisp bright top-edge highlight, a tight
                // higher-contrast specular glint near one corner, and a
                // heavier elevation shadow than the earlier candidates --
                // monochrome only, no second hue anywhere.
                <div
                  key={c.range}
                  className={`relative overflow-hidden rounded-2xl p-6 text-center border transition-all hover:-translate-y-1 hover:border-[#D4AF37]/75 ${c.featured ? 'border-[#D4AF37]/60' : 'border-[#D4AF37]/20'}`}
                  style={{
                    background: '#9AA1A8',
                    boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.22), 0 12px 30px rgba(15,14,12,0.24)',
                  }}
                >
                  {/* Crisp specular glint -- tight, brighter than the
                      earlier candidates, near the top-left corner only, so
                      it reads as light catching a stamped metal edge rather
                      than a soft ambient wash. */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse 130px 55px at 15% -10%, rgba(255,255,255,0.65) 0%, transparent 55%)' }}
                  />
                  {c.featured && (
                    <div className="absolute top-3.5 right-[-22px] bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black text-[9px] font-bold tracking-[0.1em] px-8 py-1 rotate-45">BEST VALUE</div>
                  )}
                  <h3 className="relative font-heading text-[15px] font-bold text-[#1A1A1A] mb-1.5">{c.range}</h3>
                  {/* Gold color itself unchanged throughout every Titanium
                      iteration (still exactly #D4AF37 -> #C99A20, per "keep
                      the stronger/deeper Pepscore gold, do not change the
                      percentages"). Flat metallic silvers in this luminance
                      range sit close to this gold's own luminance regardless
                      of exact hex, so a drop-shadow filter (not a background
                      halo/backdrop -- that was tried and rejected earlier)
                      on the text itself restores edge definition; it
                      follows the glyph shapes exactly since drop-shadow
                      operates on alpha, unlike text-shadow on bg-clip-text
                      which some browsers render inconsistently on clipped/
                      transparent fills. */}
                  <div
                    className="relative font-heading text-[26px] font-extrabold bg-gradient-to-br from-[#D4AF37] to-[#C99A20] bg-clip-text text-transparent"
                    style={{ filter: 'drop-shadow(0 1px 1.5px rgba(20,16,8,0.45))' }}
                  >
                    {c.save}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[12px] text-white/40 mb-10 -mt-4">Discount applies off the Standard Case price. Contact us to arrange bulk-quantity orders.</p>
            <div className="text-center">
              <LeadCaptureTrigger
                interestType="PROFESSIONAL_ACCESS_INQUIRY"
                modalTitle="Inquire About Wholesale Orders"
                modalDescription="Tell us about your research volume needs and a member of our team will follow up with SPA/wholesale pricing."
                showMessageField
                triggerLabel="Inquire About Wholesale Orders"
                triggerClassName="inline-block bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-full transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(212,175,55,0.45)]"
              />
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="relative overflow-hidden py-24 px-6 bg-gradient-to-b from-black via-[#0a0906] to-black scroll-mt-[88px]">
          {/* Bolder amino-chain/molecular-bond moment -- one of the
              "sometimes stronger" beats in the page's overall rhythm,
              deliberately on the opposite side from the Bulk section's
              particle field above rather than a repeat of it. */}
          <ScientificBackground intensity="strong" position="object-right-top" zoom={2} fadeLeft fadeBottom />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 700px 400px at 85% 20%, rgba(212,175,55,0.06) 0%, transparent 70%)' }}
          />
          <div className="max-w-[1200px] mx-auto relative">
            <div className="text-center mb-14">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Why Researchers Choose Us</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold mb-3">
                <span className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#8A6B1A] bg-clip-text text-transparent">The Pepscore Lab</span>{' '}
                <span className="text-white">Standard</span>
              </h2>
              <p className="text-[16px] font-light text-white/55 max-w-[540px] mx-auto">Every vial is backed by rigorous quality assurance and a commitment to research excellence.</p>
              <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mx-auto mt-3.5 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {[
                { icon:'🔬', title:'Third-Party Verified', body:'Every batch undergoes independent laboratory testing for purity above 98%, confirmed by HPLC and mass spectrometry.' },
                { icon:'📦', title:'Lyophilized Stability', body:'Products ship lyophilized (freeze-dried) for room-temperature shelf stability from our facility to your laboratory.' },
                { icon:'📋', title:'COA Certified Products', body:'Every compound is independently lab-tested, with Certificate of Analysis documentation on file for composition and purity verification.' },
                { icon:'⚡', title:'Fast Fulfillment', body:'Orders processed and shipped within 24–48 hours. Bulk orders receive priority handling and a dedicated account contact.' },
                // Carried over from the landing page (owner-approved wording,
                // preserved verbatim). "Sterile Manufacturing" describes the
                // certified pharmaceutical laboratory's environment, not a
                // Pepscore Lab-operated facility -- same distinction the
                // Mission copy above already draws.
                { icon:'🔒', title:'Sterile Manufacturing', body:'Controlled clean-room environments and sterile synthesis protocols for pharmaceutical-grade consistency.' },
                // No CTA in this card by design (2026-08-12) -- a nested
                // LeadCaptureTrigger here caused a scroll glitch, and the
                // Bulk section above already carries the homepage's one
                // wholesale-inquiry CTA; this card stays informational.
                { icon:'🤝', title:'Wholesale Partnerships', body:'Tiered wholesale pricing, dedicated account management, and priority fulfillment for volume buyers.' },
              ].map(f => (
                // Dark Bronze card surface (2026-08-15 metallic-card
                // selection, owner-approved preview) -- replaces the prior
                // bg-gradient-to-b from-[#141414] to-[#0a0a0a]. Deeper/more
                // substantial than Section 1's Champagne Bronze by design;
                // the #6B4526/#8B5F35 mid-stops keep it visibly bronze
                // rather than collapsing into black. Text stays light/cream
                // since this surface is darker overall than Section 1's.
                <div
                  key={f.title}
                  className="relative overflow-hidden border border-[#D4AF37]/20 rounded-2xl p-8 text-center transition-all hover:-translate-y-1 hover:border-[#D4AF37]/70 hover:shadow-[0_16px_40px_rgba(212,175,55,0.25)]"
                  style={{ background: 'linear-gradient(155deg, #1F130D 0%, #3D2818 22%, #6B4526 48%, #8B5F35 62%, #3D2818 82%, #1F130D 100%)' }}
                >
                  <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  <div className="w-[62px] h-[62px] bg-gradient-to-br from-[#1c1c1c] to-[#0a0a0a] border border-black/30 rounded-full flex items-center justify-center mx-auto mb-4 text-[26px]">{f.icon}</div>
                  <h3 className="font-heading text-[16px] font-bold text-[#EBDCC8] mb-2.5">{f.title}</h3>
                  <p className="text-[13px] text-[#EBDCC8]/70 leading-[1.7] mb-0">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ────────────────────────────────────────────────────────── */}
        <section id="about" className="relative overflow-hidden py-24 px-6 bg-black scroll-mt-[88px]">
          {/* Full, unzoomed DNA helix mirrored onto the left edge (object-
              position samples the source's right-side helix, then flip
              mirrors the whole rendered box so it lands on the left) --
              the page's second strong DNA moment after the hero, not
              just molecular texture. */}
          <ScientificBackground intensity="strong" position="object-right" flip fadeLeft={false} fadeRight />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 640px 500px at 15% 80%, rgba(212,175,55,0.06) 0%, transparent 65%)' }}
          />
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-[72px] items-center relative">
            <div className="relative">
              {/* Re-swapped 2026-08-12 (owner-corrected newPShero2.png,
                  saved under a new versioned filename -- pepscore-mission-
                  v2.png -- for the same cache-busting reason as the hero
                  image above). This corrected file's real dimensions
                  (1536x1024) differ from the previous mission-vials.png's
                  1672x941, so width/height were updated to match -- getting
                  this wrong would have next/image silently stretching the
                  new artwork into the old ratio. Deliberately stationary,
                  no animate-float, distinct from the hero's motion
                  treatment per the owner's explicit direction that these
                  two placements should feel different. */}
              <Image src="/images/pepscore-mission-v2.png" alt="Pepscore Lab Peptide Collection" width={1536} height={1024} className="w-full h-auto rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]" />
              <div className="absolute inset-[-14px_-14px_14px_14px] border border-[#D4AF37]/30 rounded-2xl -z-10 hidden md:block" />
            </div>
            <div>
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-[#D4AF37] mb-3 block">Our Mission</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-2">Research Peptides Rooted in Science</h2>
              <div className="w-11 h-[3px] bg-gradient-to-r from-[#F6D365] via-[#D4AF37] to-[#C99A20] mb-6 rounded-full" />
              <p className="text-[15px] text-white/65 leading-[1.8] mb-4">
                Our mission is to make high-quality research compounds more accessible by pairing pharmaceutical-grade quality with highly competitive pricing. We are committed to offering exceptional value without compromising the standards of the products we supply, supported by a price-matching guarantee designed to help researchers obtain the compounds they need at a fair market price. Our products are produced through a certified pharmaceutical laboratory under rigorous manufacturing and quality-control standards. We focus on delivering reliable, consistently produced lyophilized compounds for research use only.
              </p>
              <p className="text-[15px] text-white/65 leading-[1.8] mb-6">
                Our catalog spans the most studied peptide classes — from metabolic regulators like Semaglutide, Tirzepatide, and Retatrutide to longevity compounds like Epithalon and NAD+. Each product is manufactured under stringent quality-control standards and independently verified before it reaches you.
              </p>
              <div className="space-y-3.5">
                {[
                  { icon:'🏅', title:'Pharmaceutical-Grade Quality', body:'All RUO compounds synthesized to ≥98% purity, verified by HPLC and mass spectrometry.' },
                  { icon:'🤝', title:'Researcher-First Service', body:'Dedicated support for inquiries, custom quantities, and bulk procurement needs.' },
                  { icon:'🔒', title:'Discreet & Compliant', body:'Shipped in professional packaging with full compliance.' },
                ].map(v => (
                  <div key={v.title} className="flex gap-3 items-start">
                    <div className="w-[34px] h-[34px] bg-[#D4AF37]/10 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0">{v.icon}</div>
                    <div>
                      <h4 className="font-heading text-[13px] font-bold text-white mb-0.5">{v.title}</h4>
                      <p className="text-[12px] text-white/50 leading-[1.5]">{v.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────────────────────────────── */}
        <section className="py-[72px] px-6 bg-gradient-to-br from-[#8A6B1A] via-[#D4AF37] to-[#E8C84A] text-center">
          <div className="max-w-[680px] mx-auto">
            <h2 className="font-heading text-[clamp(26px,4vw,40px)] font-extrabold text-black mb-3.5">
              Ready to Elevate Your Research?
            </h2>
            <p className="text-[16px] text-black/70 mb-8 leading-[1.7]">
              Join laboratories sourcing premium peptides from Pepscore Lab. Bulk pricing available — contact us for a custom quote tailored to your program.
            </p>
            <Link
              href="#products"
              className="inline-block bg-black text-[#D4AF37] font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-10 py-4 rounded-full hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Browse the Catalog
            </Link>
          </div>
        </section>

        <ContactSection />
      </main>

      <Footer />
    </>
  )
}

// ─── Static fallback data (used only when the DB itself is unreachable) ──────
// Already in consolidated format — each entry has a variants array. Uses the
// same standardCasePrice/unitsPerCase/individualVialPrice shape ProductCard
// expects from real data; these numbers are the same outage-fallback values
// as before, just relabeled to the new field names rather than the old
// price/bulkPrice5/bulkPrice10 tiers, which no longer correspond to
// anything in the authoritative pricing model.

const STATIC_PRODUCTS: ProductCardProps[] = [
  {
    name: 'Semaglutide', category: 'GLP-1 Agonist', badge: 'Popular',
    imageUrl: '/images/products/families/Semaglutide.png',
    description: 'GLP-1 receptor agonist studied for metabolic regulation, glucose homeostasis, and appetite suppression research.',
    variants: [
      { id:'1a', slug:'semaglutide-5mg',  size:'5mg',  standardCasePrice:138, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'1b', slug:'semaglutide-10mg', size:'10mg', standardCasePrice:165, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'1c', slug:'semaglutide-20mg', size:'20mg', standardCasePrice:258, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'1d', slug:'semaglutide-30mg', size:'30mg', standardCasePrice:318, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'Tirzepatide', category: 'Dual GIP/GLP-1', badge: 'Best Seller',
    imageUrl: '/images/products/families/Tirzepatide.png',
    description: 'Dual GIP/GLP-1 receptor agonist studied for superior metabolic outcomes and cardiometabolic research applications.',
    variants: [
      { id:'2a', slug:'tirzepatide-5mg',  size:'5mg',  standardCasePrice:147, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'2b', slug:'tirzepatide-10mg', size:'10mg', standardCasePrice:183, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'2c', slug:'tirzepatide-20mg', size:'20mg', standardCasePrice:327, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'2d', slug:'tirzepatide-60mg', size:'60mg', standardCasePrice:696, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'Retatrutide', category: 'Triple Agonist', badge: 'New',
    imageUrl: '/images/products/families/Retatrutide.png',
    description: 'Triple receptor agonist (GIP/GLP-1/Glucagon) — the next generation of metabolic research compounds.',
    variants: [
      { id:'3a', slug:'retatrutide-5mg',  size:'5mg',  standardCasePrice:240, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'3b', slug:'retatrutide-10mg', size:'10mg', standardCasePrice:327, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'3c', slug:'retatrutide-30mg', size:'30mg', standardCasePrice:642, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'3d', slug:'retatrutide-60mg', size:'60mg', standardCasePrice:978, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'NAD+', category: 'Coenzyme', badge: null,
    imageUrl: '/images/products/families/NAD+.png',
    description: 'Essential coenzyme precursor critical for cellular energy metabolism, DNA repair, and longevity pathway research.',
    variants: [
      { id:'4a', slug:'nad-plus-100mg', size:'100mg', standardCasePrice:168, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'4b', slug:'nad-plus-500mg', size:'500mg', standardCasePrice:264, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'Epithalon', category: 'Longevity Peptide', badge: null,
    imageUrl: '/images/products/families/Epithalon.png',
    description: 'Tetrapeptide studied for telomerase activation, circadian regulation, and cellular-aging biological processes.',
    variants: [
      { id:'5a', slug:'epithalon-10mg', size:'10mg', standardCasePrice:144, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'5b', slug:'epithalon-50mg', size:'50mg', standardCasePrice:369, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'CJC-1295 / Ipamorelin', category: 'GH Secretagogue', badge: null,
    imageUrl: '/images/products/families/CJC-1295 and Ipamorelin.png',
    description: 'Synergistic GHRH analog and selective ghrelin mimetic combination for growth hormone secretion research.',
    variants: [
      { id:'6a', slug:'cjc1295-ipa-10mg', size:'10mg', standardCasePrice:297, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'KissPeptin-10', category: 'Reproductive Peptide', badge: null,
    imageUrl: '/images/products/families/KissPeptin-10.png',
    description: 'Hypothalamic neuropeptide studied for reproductive endocrinology, LH/FSH regulation, and fertility research.',
    variants: [
      { id:'7a', slug:'kisspeptin-10-5mg',  size:'5mg',  standardCasePrice:186, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'7b', slug:'kisspeptin-10-10mg', size:'10mg', standardCasePrice:285, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
  {
    name: 'GHK-Cu', category: 'Copper Peptide', badge: null,
    imageUrl: '/images/products/families/GHK-Cu.png',
    description: 'Copper-binding tripeptide widely researched for tissue remodeling, wound healing, and dermal regeneration.',
    variants: [
      { id:'8a', slug:'ghk-cu-50mg',  size:'50mg',  standardCasePrice:108, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
      { id:'8b', slug:'ghk-cu-100mg', size:'100mg', standardCasePrice:174, unitsPerCase:null, individualVialPrice:null, proCasePrice:null, caseAvailability:'AVAILABLE', individualVialAvailability:'AVAILABLE', availabilityMessageOverride:null },
    ],
  },
]
