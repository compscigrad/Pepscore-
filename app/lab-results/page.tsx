// Lab Results / COA page -- 2026-08-12 homepage revision pass #2, section
// 19. Unlike the sitewide "COA Certified Products" trust badge, this
// dedicated page is where "documentation available on request" language
// belongs, per explicit owner direction on this page specifically. Does
// NOT claim a COA ships or is emailed automatically with every order.
// "Third-party tested" is stated here because the owner asserted it
// directly; flagged in docs/PendingOwnerActions.md for confirmation
// against actual supplier/lab documentation before being treated as
// fully verified, rather than silently asserted without any backing.
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { PolicyPageLayout, PolicyHeading } from '@/components/storefront/PolicyPageLayout'

export const metadata: Metadata = {
  title: 'Lab Results / COA | Pepscore Lab',
  description: 'Pepscore Lab Certificate of Analysis (COA) and lab-testing information.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/lab-results' },
}

export default function LabResultsPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <PolicyPageLayout title="Lab Results / COA" updated="August 12, 2026">
        <p>
          Pepscore Lab products are COA Certified Products — every compound is independently lab-tested, with
          Certificate of Analysis (COA) documentation on file for composition and purity verification.
        </p>

        <PolicyHeading>How to Get a COA</PolicyHeading>
        <p>
          COA documentation is not automatically included or emailed with every order. If you&rsquo;d like the
          Certificate of Analysis for a specific product/batch you&rsquo;ve purchased or are considering, contact us
          at{' '}
          <a href="mailto:contact@pepscorelab.com" className="text-[#D4AF37] hover:underline">contact@pepscorelab.com</a>{' '}
          with the product name and, if you have it, your order number — we&rsquo;ll provide the relevant
          documentation.
        </p>

        <PolicyHeading>What a COA Covers</PolicyHeading>
        <p>
          A Certificate of Analysis documents independent lab-testing results for a given product batch, including
          composition and purity verification (e.g. HPLC/mass-spectrometry results referenced elsewhere on this
          site).
        </p>

        <PolicyHeading>Research Use Only</PolicyHeading>
        <p>
          All Pepscore Lab products, and the documentation on this page, relate exclusively to research use. Nothing
          on this page is intended as, or should be interpreted as, guidance for human or veterinary use, dosing, or
          treatment.
        </p>
      </PolicyPageLayout>
      <Footer />
    </>
  )
}
