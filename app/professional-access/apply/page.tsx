// Professional Access application page (2026-08-19 Professional Access
// sprint, section 10) -- a dedicated route rather than a modal, so a real
// business-verification application has room to be a real form. See
// components/storefront/ProfessionalAccessApplicationForm.tsx for the form
// itself and lib/professionalAccess/applications.ts for the intake logic.
import type { Metadata } from 'next'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { ProfessionalAccessApplicationForm } from '@/components/storefront/ProfessionalAccessApplicationForm'

export const metadata: Metadata = {
  title: 'Professional Access | Pepscore Lab',
  description: 'Apply for Professional Access — preferred case pricing for verified businesses and qualified research organizations.',
  alternates: { canonical: '/professional-access/apply' },
}

export default function ProfessionalAccessApplyPage() {
  return (
    <>
      <CartSidebar />
      <Header />
      <ProfessionalAccessApplicationForm />
      <Footer />
    </>
  )
}
