// AI-1.8 -- the actual entry point for the customer-facing Pepscore
// Intelligence experience built in AI-1.3/1.6. Dark by default: 404s via
// notFound() when AI_FEATURE_ENABLED is off, the same posture as
// /api/ai/intelligence itself returning 503 -- an anonymous visitor gets
// no hint this route exists either way. force-dynamic so the flag is
// re-read per request rather than baked in at build time (matches the
// sibling admin intelligence pages' own dynamic export).
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { loadAiConfig } from '@/lib/ai/providers/config'
import { PepscoreIntelligenceConcierge } from '@/components/storefront/PepscoreIntelligenceConcierge'

export const metadata: Metadata = {
  title: 'Pepscore Intelligence | Pepscore Lab',
  description: 'Compare research classifications, browse by research category, and explore compound research areas.',
  robots: { index: false, follow: false },
}

export default function ResearchIntelligencePage() {
  if (!loadAiConfig().featureEnabled) {
    notFound()
  }

  return (
    <>
      <CartSidebar />
      <Header />
      <PepscoreIntelligenceConcierge />
      <Footer />
    </>
  )
}
