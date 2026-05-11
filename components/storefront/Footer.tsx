// Site footer with RUO disclaimer, product links, contact info
import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer id="contact" className="bg-[#111] text-white pt-14 pb-7 px-6">
      <div className="max-w-[1200px] mx-auto">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr] gap-11 pb-11 border-b border-white/10">

          {/* Brand column */}
          <div>
            <div className="overflow-hidden w-24 h-9 relative mb-3">
              <Image src="/images/logo.png" alt="Pepscore" fill className="object-cover object-left-top scale-[1.42]" />
            </div>
            <p className="text-[13px] text-white/55 leading-relaxed mb-4">
              Precision-grade research peptides for laboratories that refuse to compromise on quality or consistency.
            </p>
            {/* RUO disclaimer box */}
            <div className="text-[11px] text-white/35 leading-relaxed border border-white/10 p-3 rounded-md">
              ⚠️ All Pepscore products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. Must be handled by qualified researchers in appropriate laboratory environments.
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-gold mb-3">Products</h4>
            <ul className="space-y-2">
              {['Semaglutide','Tirzepatide','Retatrutide','NAD+','Epithalon','CJC-1295 / Ipamorelin','Kisspeptin-10','GHK-Cu','PT-141'].map(p => (
                <li key={p}>
                  <Link href="/#products" className="text-[13px] text-white/60 hover:text-gold transition-colors">
                    {p}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Information */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-gold mb-3">Information</h4>
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
                  <Link href={href} className="text-[13px] text-white/60 hover:text-gold transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-gold mb-3">Contact</h4>
            <div className="space-y-3">
              <div className="flex gap-2 items-start">
                <span className="text-[15px] mt-0.5">✉️</span>
                <span className="text-[13px] text-white/60">contact@pepscore.com</span>
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
                className="inline-block bg-gold hover:bg-gold-dark text-white font-heading text-[12px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 rounded-md transition-colors"
              >
                Order Now
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-wrap justify-between items-center gap-3">
          <p className="text-[12px] text-white/40">
            © {new Date().getFullYear()} Pepscore — Holistic Research Peptides. All rights reserved. For research purposes only.
          </p>
          <div className="flex gap-5">
            {['Privacy', 'Terms', 'COAs'].map(l => (
              <Link key={l} href="#" className="text-[12px] text-white/40 hover:text-gold transition-colors">
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
