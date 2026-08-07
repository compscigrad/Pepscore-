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
import { getStorefrontPrice } from '@/lib/storefront/pricing'
import { getStorefrontAvailability } from '@/lib/storefront/availability'
import { resolveProductImage } from '@/lib/storefront/productImages'

// Revalidate every 60 s so product changes reflect quickly without a full deploy
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

type DbProduct = Awaited<ReturnType<typeof getProducts>>[number]

// Groups flat product rows by name into consolidated cards with a variants array.
// Every row is kept regardless of pricing or stock state — a variant with no
// approved active price still browses (ProductCard shows a "pricing
// available on request" state instead of a fabricated number, see
// lib/storefront/pricing.ts), and an out-of-stock/limited/coming-soon
// variant still browses too, with its real availability state shown instead
// of disappearing from the catalog (lib/storefront/availability.ts).
function groupByName(rows: DbProduct[]): ProductCardProps[] {
  const map = new Map<string, ProductCardProps>()
  for (const p of rows) {
    const price = getStorefrontPrice(p)
    const variant = {
      id: p.id,
      slug: p.slug,
      size: p.size,
      standardCasePrice: price?.standardCasePrice ?? null,
      unitsPerCase: price?.unitsPerCase ?? null,
      individualVialPrice: price?.individualVialPrice ?? null,
      availability: getStorefrontAvailability(p),
    }
    const existing = map.get(p.name)
    if (existing) {
      existing.variants.push(variant)
    } else {
      map.set(p.name, {
        name: p.name,
        category: p.category,
        description: p.description ?? '',
        imageUrl: resolveProductImage(p.name, p.imageUrl),
        badge: p.badge ?? null,
        variants: [variant],
      })
    }
  }
  return Array.from(map.values())
}

export default async function HomePage() {
  // Gracefully fall back to empty array if DB isn't configured yet
  const rawProducts = await getProducts().catch(() => [])
  const products = groupByName(rawProducts)

  // Flat, priced rows for the reference pricing table below — built from the
  // same real query, not the old hardcoded PRICING_TABLE. Only products that
  // have actually been through pricing review and have an approved active
  // price appear here; the section itself is omitted entirely rather than
  // ever show a fabricated number.
  const pricedRows = rawProducts
    .map((p) => ({ name: p.name, size: p.size, price: getStorefrontPrice(p) }))
    .filter((r): r is { name: string; size: string; price: NonNullable<ReturnType<typeof getStorefrontPrice>> } => r.price != null)

  return (
    <>
      <CartSidebar />

      {/* Announcement bar */}
      <div className="bg-gold text-white text-center py-2 px-6 font-heading text-[12px] font-bold tracking-[0.08em] uppercase">
        🔬 Free Shipping on Orders Over $150 &nbsp;|&nbsp; For Research Purposes Only &nbsp;|&nbsp; Lab-Verified Purity ≥98%
      </div>

      <Header />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-cream via-[#F5EFE0] to-[#EDE0C8] py-20 px-6">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <div className="overflow-hidden w-[200px] h-[80px] relative mb-6">
                <Image src="/images/logo.png" alt="Pepscore" fill className="object-cover object-left-top scale-[1.43]" priority />
              </div>
              <div className="inline-block bg-gold/12 text-gold-dark border border-gold/30 rounded-full px-4 py-1.5 font-heading text-[11px] font-bold tracking-[0.12em] uppercase mb-5">
                Holistic Research Peptides
              </div>
              <h1 className="font-heading text-[clamp(34px,5vw,54px)] font-extrabold leading-[1.1] text-dark mb-5">
                Precision-Grade<br />
                <span className="text-gold">Peptides</span> for<br />
                Serious Research
              </h1>
              <p className="text-[17px] font-light text-g700 leading-[1.7] mb-9 max-w-[480px]">
                Pepscore delivers pharmaceutical-quality research peptides with independently verified purity above 98%. Trusted by laboratories worldwide for consistent, reliable compounds.
              </p>
              <div className="flex gap-4 flex-wrap">
                <Link
                  href="#products"
                  className="bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-md transition-all hover:-translate-y-0.5 hover:shadow-gold"
                >
                  Shop All Products
                </Link>
                <Link
                  href="#about"
                  className="border-2 border-dark text-dark font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-md transition-all hover:bg-dark hover:text-white hover:-translate-y-0.5"
                >
                  Our Story
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-9 mt-11 pt-7 border-t border-gold/20 flex-wrap">
                {[['≥98%','Verified Purity'],['8+','Peptide Compounds'],['Bulk','Pricing Available']].map(([v,l]) => (
                  <div key={l}>
                    <h3 className="font-heading text-[26px] font-extrabold text-gold">{v}</h3>
                    <p className="text-[12px] text-g500 m-0">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image */}
            <div className="flex justify-center items-center">
              <Image
                src="/images/hero-vials.jpeg"
                alt="Pepscore Research Peptide Collection"
                width={540}
                height={540}
                className="w-full max-w-[540px] rounded-2xl drop-shadow-xl animate-float"
                priority
              />
            </div>
          </div>
        </section>

        {/* ── Products ─────────────────────────────────────────────────────── */}
        <section id="products" className="py-24 px-6 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-14">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3 block">Research Catalog</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">Premium Research Peptides</h2>
              <p className="text-[16px] font-light text-g500 max-w-[540px] mx-auto leading-[1.7]">
                Every compound is third-party tested, precisely dosed, and formulated for research excellence.
              </p>
              <div className="w-11 h-[3px] bg-gold mx-auto mt-3.5 rounded-full" />
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

        {/* ── Pricing Table ────────────────────────────────────────────────── */}
        {/* Omitted entirely, not shown empty, when no product has an
            approved active price yet — never render a placeholder table
            with fabricated numbers. */}
        {pricedRows.length > 0 && (
          <section id="pricing" className="py-24 px-6 bg-white">
            <div className="max-w-[960px] mx-auto">
              <div className="text-center mb-14">
                <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3 block">Transparent Pricing</span>
                <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">Full Pricing Reference</h2>
                <p className="text-[16px] font-light text-g500 max-w-[540px] mx-auto">Standard case pricing for every published product. All prices in USD.</p>
                <div className="w-11 h-[3px] bg-gold mx-auto mt-3.5 rounded-full" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse rounded-2xl overflow-hidden shadow-sm2">
                  <thead>
                    <tr>
                      {['Product', 'Vial Size', 'Standard Case', 'Per Vial'].map((h) => (
                        <th key={h} className="bg-dark text-white font-heading text-[12px] font-bold tracking-[0.08em] uppercase py-3.5 px-4 text-left first:text-left [&:not(:first-child)]:text-center">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pricedRows.map((row, i) => (
                      <tr key={`${row.name}-${row.size}`} className={i % 2 === 1 ? 'bg-g100' : ''}>
                        <td className="py-3.5 px-4 text-[14px] border-b border-g100 font-heading font-bold text-dark">{row.name}</td>
                        <td className="py-3.5 px-4 text-[14px] border-b border-g100 text-center font-heading font-semibold text-dark">{row.size}</td>
                        <td className="py-3.5 px-4 text-[14px] border-b border-g100 text-center font-heading font-semibold text-dark">
                          ${row.price.standardCasePrice}
                          {row.price.unitsPerCase ? ` / case of ${row.price.unitsPerCase}` : ''}
                        </td>
                        <td className="py-3.5 px-4 text-[14px] border-b border-g100 text-center font-heading font-semibold text-dark">
                          {row.price.individualVialPrice != null ? `$${row.price.individualVialPrice}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-center mt-5 text-[13px] text-g500">
                All products for research purposes only.{' '}
                <Link href="#contact" className="text-gold hover:underline">Contact us</Link> for custom bulk quotes.
              </p>
            </div>
          </section>
        )}

        {/* ── Bulk Section ─────────────────────────────────────────────────── */}
        <section id="bulk" className="py-20 px-6 bg-gradient-to-br from-dark to-[#2C2620] text-white">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-11">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold-light mb-3 block">Volume Savings</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-3">Bulk Pricing for Researchers</h2>
              <p className="text-[16px] font-light text-white/70 max-w-[540px] mx-auto">Scale your research without scaling your costs.</p>
              <div className="w-11 h-[3px] bg-gold mx-auto mt-3.5 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
              {[
                { icon:'🧪', title:'Single Unit', disc:'Standard', desc:'Order any product at regular pricing. No minimums — perfect for evaluating new compounds.', featured: false },
                { icon:'📦', title:'Bulk 5', disc:'Save ~54%', desc:'Order 5 units and unlock significant per-unit savings. Ideal for ongoing research programs.', featured: false },
                { icon:'🏆', title:'Bulk 10', disc:'Lowest Price', desc:'Our best value tier. Maximize your research budget with the lowest per-unit pricing available.', featured: true },
              ].map(c => (
                <div key={c.title} className={`relative overflow-hidden rounded-2xl p-7 text-center border transition-all hover:-translate-y-1 ${c.featured ? 'border-gold bg-gold/12' : 'border-gold/30 bg-white/6'}`}>
                  {c.featured && (
                    <div className="absolute top-3.5 right-[-22px] bg-gold text-white text-[9px] font-bold tracking-[0.1em] px-8 py-1 rotate-45">BEST VALUE</div>
                  )}
                  <div className="text-4xl mb-3">{c.icon}</div>
                  <h3 className="font-heading text-[19px] font-bold text-white mb-1.5">{c.title}</h3>
                  <div className="font-heading text-[34px] font-extrabold text-gold mb-1.5">{c.disc}</div>
                  <p className="text-[13px] text-white/65 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="#contact" className="inline-block bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-8 py-4 rounded-md transition-all hover:-translate-y-0.5">
                Inquire About Bulk Orders
              </Link>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 bg-cream">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-14">
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3 block">Why Researchers Choose Us</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-3">The Pepscore Standard</h2>
              <p className="text-[16px] font-light text-g500 max-w-[540px] mx-auto">Every vial is backed by rigorous quality assurance and a commitment to research excellence.</p>
              <div className="w-11 h-[3px] bg-gold mx-auto mt-3.5 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7">
              {[
                { icon:'🔬', title:'Third-Party Verified', body:'Every batch undergoes independent laboratory testing for purity above 98%, confirmed by HPLC and mass spectrometry.' },
                { icon:'❄️', title:'Cold-Chain Shipping', body:'All products ship temperature-controlled to maintain molecular integrity from our facility to your laboratory.' },
                { icon:'📋', title:'Certificates of Analysis', body:'Full COAs accompany every order, providing complete transparency on composition, purity, and testing results.' },
                { icon:'⚡', title:'Fast Fulfillment', body:'Orders processed and shipped within 24–48 hours. Bulk orders receive priority handling and a dedicated account contact.' },
              ].map(f => (
                <div key={f.title} className="bg-white border border-gold/12 rounded-2xl p-8 text-center transition-all hover:-translate-y-1 hover:shadow-sm2 hover:border-gold">
                  <div className="w-[62px] h-[62px] bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[26px]">{f.icon}</div>
                  <h3 className="font-heading text-[16px] font-bold text-dark mb-2.5">{f.title}</h3>
                  <p className="text-[13px] text-g500 leading-[1.7]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ────────────────────────────────────────────────────────── */}
        <section id="about" className="py-24 px-6 bg-cream">
          <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-[72px] items-center">
            <div className="relative">
              <Image src="/images/hero-vials.jpeg" alt="Pepscore Peptide Collection" width={600} height={500} className="w-full rounded-2xl shadow-sl" />
              <div className="absolute inset-[-14px_-14px_14px_14px] border-2 border-gold/30 rounded-2xl -z-10 hidden md:block" />
            </div>
            <div>
              <span className="font-heading text-[11px] font-bold tracking-[0.15em] uppercase text-gold mb-3 block">Our Mission</span>
              <h2 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-dark mb-2">Holistic Peptides Rooted in Science</h2>
              <div className="w-11 h-[3px] bg-gold mb-6 rounded-full" />
              <p className="text-[15px] text-g700 leading-[1.8] mb-4">
                At Pepscore, we believe breakthrough research begins with reliable raw materials. Founded by scientists with a passion for precision biochemistry, we supply research-grade peptides to laboratories that demand the highest standards of purity and consistency.
              </p>
              <p className="text-[15px] text-g700 leading-[1.8] mb-6">
                Our catalog spans the most studied peptide classes — from metabolic regulators like Semaglutide and Tirzepatide, to longevity compounds like Epithalon and NAD+. Each product is synthesized under GMP-compliant conditions and independently verified before it reaches your bench.
              </p>
              <div className="space-y-3.5">
                {[
                  { icon:'🏅', title:'Research-Grade Quality', body:'All compounds synthesized to ≥98% purity, verified by HPLC and mass spectrometry.' },
                  { icon:'🤝', title:'Researcher-First Service', body:'Dedicated support for inquiries, custom quantities, and bulk procurement needs.' },
                  { icon:'🔒', title:'Discreet & Compliant', body:'Shipped in professional packaging with full compliance documentation included.' },
                ].map(v => (
                  <div key={v.title} className="flex gap-3 items-start">
                    <div className="w-[34px] h-[34px] bg-gold/10 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0">{v.icon}</div>
                    <div>
                      <h4 className="font-heading text-[13px] font-bold text-dark mb-0.5">{v.title}</h4>
                      <p className="text-[12px] text-g500 leading-[1.5]">{v.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ───────────────────────────────────────────────────── */}
        <section className="py-[72px] px-6 bg-gradient-to-br from-gold-dark via-gold to-gold-light text-center">
          <div className="max-w-[680px] mx-auto">
            <h2 className="font-heading text-[clamp(26px,4vw,40px)] font-extrabold text-white mb-3.5">
              Ready to Elevate Your Research?
            </h2>
            <p className="text-[16px] text-white/85 mb-8 leading-[1.7]">
              Join laboratories sourcing premium peptides from Pepscore. Bulk pricing available — contact us for a custom quote tailored to your program.
            </p>
            <Link
              href="#products"
              className="inline-block bg-white text-gold-dark font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-10 py-4 rounded-md hover:-translate-y-0.5 hover:shadow-lg transition-all"
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
    imageUrl: '/images/Semaglutide.png',
    description: 'GLP-1 receptor agonist studied for metabolic regulation, glucose homeostasis, and appetite suppression research.',
    variants: [
      { id:'1a', slug:'semaglutide-5mg',  size:'5mg',  standardCasePrice:138, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'1b', slug:'semaglutide-10mg', size:'10mg', standardCasePrice:165, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'1c', slug:'semaglutide-20mg', size:'20mg', standardCasePrice:258, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'1d', slug:'semaglutide-30mg', size:'30mg', standardCasePrice:318, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'Tirzepatide', category: 'Dual GIP/GLP-1', badge: 'Best Seller',
    imageUrl: '/images/Tirzepatide.png',
    description: 'Dual GIP/GLP-1 receptor agonist studied for superior metabolic outcomes and cardiometabolic research applications.',
    variants: [
      { id:'2a', slug:'tirzepatide-5mg',  size:'5mg',  standardCasePrice:147, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'2b', slug:'tirzepatide-10mg', size:'10mg', standardCasePrice:183, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'2c', slug:'tirzepatide-20mg', size:'20mg', standardCasePrice:327, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'2d', slug:'tirzepatide-60mg', size:'60mg', standardCasePrice:696, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'Retatrutide', category: 'Triple Agonist', badge: 'New',
    imageUrl: '/images/Retatrutide.png',
    description: 'Triple receptor agonist (GIP/GLP-1/Glucagon) — the next generation of metabolic research compounds.',
    variants: [
      { id:'3a', slug:'retatrutide-5mg',  size:'5mg',  standardCasePrice:240, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'3b', slug:'retatrutide-10mg', size:'10mg', standardCasePrice:327, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'3c', slug:'retatrutide-30mg', size:'30mg', standardCasePrice:642, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'3d', slug:'retatrutide-60mg', size:'60mg', standardCasePrice:978, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'NAD+', category: 'Coenzyme', badge: null,
    imageUrl: '/images/nad.png',
    description: 'Essential coenzyme precursor critical for cellular energy metabolism, DNA repair, and longevity pathway research.',
    variants: [
      { id:'4a', slug:'nad-plus-100mg', size:'100mg', standardCasePrice:168, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'4b', slug:'nad-plus-500mg', size:'500mg', standardCasePrice:264, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'Epithalon', category: 'Longevity Peptide', badge: null,
    imageUrl: '/images/epithalon.png',
    description: 'Tetrapeptide studied for telomerase activation, circadian regulation, and anti-aging biological processes.',
    variants: [
      { id:'5a', slug:'epithalon-10mg', size:'10mg', standardCasePrice:144, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'5b', slug:'epithalon-50mg', size:'50mg', standardCasePrice:369, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'CJC-1295 / Ipamorelin', category: 'GH Secretagogue', badge: null,
    imageUrl: '/images/cjc1295.png',
    description: 'Synergistic GHRH analog and selective ghrelin mimetic combination for growth hormone secretion research.',
    variants: [
      { id:'6a', slug:'cjc1295-ipa-10mg', size:'10mg', standardCasePrice:297, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'KissPeptin-10', category: 'Reproductive Peptide', badge: null,
    imageUrl: '/images/kisspeptin.png',
    description: 'Hypothalamic neuropeptide studied for reproductive endocrinology, LH/FSH regulation, and fertility research.',
    variants: [
      { id:'7a', slug:'kisspeptin-10-5mg',  size:'5mg',  standardCasePrice:186, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'7b', slug:'kisspeptin-10-10mg', size:'10mg', standardCasePrice:285, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
  {
    name: 'GHK-Cu', category: 'Copper Peptide', badge: null,
    imageUrl: '/images/ghk-cu.png',
    description: 'Copper-binding tripeptide widely researched for tissue remodeling, wound healing, and dermal regeneration.',
    variants: [
      { id:'8a', slug:'ghk-cu-50mg',  size:'50mg',  standardCasePrice:108, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
      { id:'8b', slug:'ghk-cu-100mg', size:'100mg', standardCasePrice:174, unitsPerCase:null, individualVialPrice:null, availability:'AVAILABLE' },
    ],
  },
]
