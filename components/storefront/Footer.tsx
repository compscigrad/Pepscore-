// Site footer with RUO disclaimer, product links, contact info
import Link from 'next/link'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'
import { FirstOrderOfferModal } from './FirstOrderOfferModal'
import { ScientificBackground } from './ScientificBackground'
import { getActiveFirstOrderOffer } from '@/lib/promotions/firstOrderOffer'
import { formatDiscountLabel } from '@/lib/promotions/format'

// Server Component -- reads the active first-order offer directly (no
// client fetch) so the banner renders or doesn't with zero flash, and
// stays entirely absent from the DOM while the offer is off (the
// default). Copy comes from the active campaign's own publicTitle rather
// than being constructed from a raw percentage, so a fixed-dollar
// campaign (or any future copy an admin writes) renders correctly without
// a code change.
export async function Footer() {
  const offer = await getActiveFirstOrderOffer()

  return (
    <footer className="relative overflow-hidden bg-black text-white pt-14 pb-7 px-6">
      {/* Final, very subtle scientific watermark -- the page's last beat
          of the DNA/molecular system rather than an abrupt return to
          plain black. Confined and heavily faded so every footer link
          stays fully readable. */}
      <ScientificBackground intensity="subtle" position="object-right-bottom" zoom={1.5} fadeLeft fadeTop />
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
              publicTitle={offer.campaign.publicTitle}
              discountType={offer.campaign.discountType}
              discountValue={offer.campaign.discountValue}
              triggerLabel={`Claim ${formatDiscountLabel(offer.campaign.discountType, offer.campaign.discountValue)} →`}
              triggerClassName="shrink-0 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-full transition-all"
            />
          </div>
        )}

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-11 pb-11 border-b border-[#D4AF37]/15">

          {/* Brand column */}
          <div>
            <p className="font-heading text-[19px] font-extrabold tracking-[-0.01em] leading-none mb-3">
              <span className="text-white">Pepscore</span>{' '}
              <span className="bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] bg-clip-text text-transparent">Lab</span>
            </p>
            <p className="text-[13px] text-white/55 leading-relaxed mb-4">
              Precision-grade research peptides for laboratories that refuse to compromise on quality or consistency.
            </p>
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
              {['Semaglutide','Tirzepatide','Retatrutide','NAD+','Epithalon','CJC-1295 / Ipamorelin','Kisspeptin-10','GHK-Cu','PT-141'].map(p => (
                <li key={p}>
                  <Link href="/#products" className="text-[13px] text-white/60 hover:text-[#D4AF37] transition-colors">
                    {p}
                  </Link>
                </li>
              ))}
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
            <div className="mt-4">
              <Link
                href="/#products"
                className="inline-block bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 rounded-full transition-all"
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-wrap justify-between items-center gap-3">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} Pepscore Lab — Holistic Research Peptides. All rights reserved. For research purposes only.
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
