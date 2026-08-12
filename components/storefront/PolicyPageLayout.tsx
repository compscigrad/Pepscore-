// Shared layout for the site's legal/policy content pages (Terms, Privacy,
// Returns & Refunds, Shipping, Lab Results/COA). Keeps prose readable
// against the dark/gold brand system without needing a heavy typography
// plugin -- plain Tailwind utility classes on each block.
import Link from 'next/link'

interface PolicyPageLayoutProps {
  title: string
  updated: string
  children: React.ReactNode
}

export function PolicyPageLayout({ title, updated, children }: PolicyPageLayoutProps) {
  return (
    <main className="bg-black min-h-screen">
      <div className="max-w-[1200px] mx-auto px-6 pt-6 pb-2">
        <nav aria-label="Breadcrumb" className="text-[12px] text-white/45 flex items-center gap-2">
          <Link href="/" className="hover:text-[#D4AF37] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white font-semibold">{title}</span>
        </nav>
      </div>

      <div className="max-w-[820px] mx-auto px-6 py-14">
        <h1 className="font-heading text-[clamp(26px,4vw,38px)] font-bold text-white mb-2">{title}</h1>
        <p className="text-[12px] text-white/40 mb-10">Last updated: {updated}</p>
        <div className="policy-prose text-[14.5px] text-white/70 leading-[1.8] space-y-6">{children}</div>
      </div>
    </main>
  )
}

export function PolicyHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-[16px] font-bold text-[#D4AF37] mt-10 mb-3 first:mt-0">{children}</h2>
}
