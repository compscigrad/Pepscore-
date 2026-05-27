// ============================================================
// FILE: app/page.tsx  (LANDING BRANCH OVERRIDE)
// PURPOSE: Pre-launch authority landing page — PUBLIC FACING
// BRANCH: landing — DO NOT MERGE to master
// NOTE: master branch preserves full e-commerce application
// ============================================================

// Static page — no DB / Prisma / Clerk dependencies on this branch

import type { Metadata } from 'next'
import LandingHero from '@/components/landing/LandingHero'
import LandingPositioning from '@/components/landing/LandingPositioning'
import LandingCapabilities from '@/components/landing/LandingCapabilities'
import LandingForm from '@/components/landing/LandingForm'
import LandingContact from '@/components/landing/LandingContact'
import LandingFooter from '@/components/landing/LandingFooter'

export const metadata: Metadata = {
  metadataBase: new URL('https://pepscorelabs.com'),
  title: 'Pepscore Labs — Launching Soon | Precision Peptide Solutions',
  description:
    'Science. Precision. Performance. Wholesale & retail precision peptide packaging solutions. Launching soon — join our waitlist.',
  keywords: ['peptide supplier', 'peptide packaging', 'wholesale peptides', 'research peptides', 'pepscore labs'],
  openGraph: {
    title: 'Pepscore Labs — Launching Soon',
    description: 'Science. Precision. Performance. Premium peptide packaging solutions.',
    images: [{ url: '/images/logo.png' }],
  },
}

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Montserrat', 'Inter', sans-serif", background: '#000', color: '#fff', overflowX: 'hidden' }}>
      {/* Announcement Banner */}
      <div style={{
        background: 'linear-gradient(90deg, #8A6B1A 0%, #D4AF37 40%, #E8C84A 60%, #D4AF37 80%, #8A6B1A 100%)',
        padding: '9px 24px',
        textAlign: 'center',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: '#000',
        textTransform: 'uppercase',
      }}>
        ✦ &nbsp; Pepscore Labs — Launching 2025 &nbsp; | &nbsp; Precision Peptide Solutions &nbsp; ✦
      </div>
      <LandingHero />
      <LandingPositioning />
      <LandingCapabilities />
      <LandingForm />
      <LandingContact />
      <LandingFooter />
    </div>
  )
}
