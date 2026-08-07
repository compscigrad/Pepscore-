// Site footer with RUO disclaimer, product links, contact info
import Link from 'next/link'
import { LeadCaptureTrigger } from './LeadCaptureTrigger'

export function Footer() {
  return (
    <footer className="bg-black text-white pt-14 pb-7 px-6">
      <div className="max-w-[1200px] mx-auto">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-11 pb-11 border-b border-[#D4AF37]/15">

          {/* Brand column */}
          <div>
            <p className="font-heading text-[19px] font-extrabold tracking-[-0.01em] leading-none mb-3">
              <span className="text-white">Pepscore</span>{' '}
              <span className="bg-gradient-to-br from-[#D4AF37] via-[#E8C84A] to-[#D4AF37] bg-clip-text text-transparent">Lab</span>
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

          {/* Information */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-[#D4AF37] mb-3">Information</h4>
            <ul className="space-y-2">
              {[
                ['Lab Results / COAs', '#'],
                ['Bulk Pricing', '/#bulk'],
                ['Shipping Policy', '#'],
                ['Returns & Refunds', '#'],
                ['Terms of Service', '/terms'],
                ['Privacy Policy', '/privacy'],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-white/60 hover:text-[#D4AF37] transition-colors">
                    {label}
                  </Link>
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
                className="inline-block bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)] text-black font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 rounded-full transition-all"
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
          <div className="flex gap-5">
            {['Privacy', 'Terms', 'COAs'].map(l => (
              <Link key={l} href="#" className="text-[12px] text-white/40 hover:text-[#D4AF37] transition-colors">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
