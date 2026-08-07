// Root layout — wraps all routes with Clerk auth provider and global styles.
// ClerkProvider is skipped when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is absent
// so the site builds cleanly before Clerk is configured.
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import { clerkAppearance } from '@/lib/clerkAppearance'
import { organizationSchema } from '@/lib/storefront/structuredData'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscorelab.com'),
  title: 'Pepscore — Holistic Research Peptides',
  description:
    'Precision-grade research peptides with independently verified purity above 98%. For Research Use Only.',
  keywords: ['research peptides', 'semaglutide', 'tirzepatide', 'NAD+', 'epithalon', 'RUO'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Pepscore — Holistic Research Peptides',
    description: 'Pharmaceutical-quality research peptides. ≥98% purity. For Research Use Only.',
    images: [{ url: '/images/hero-vials.jpeg' }],
    type: 'website',
  },
  // Belt-and-suspenders alongside app/robots.ts's env-based rules -- this
  // covers the meta-tag-level signal too, in case a crawler ignores
  // robots.txt but respects the page's own noindex meta tag.
  robots: process.env.VERCEL_ENV === 'production' ? undefined : { index: false, follow: false },
}

const toasterProps = {
  position: 'bottom-center' as const,
  toastOptions: {
    style: {
      background: '#1A1A1A',
      color: '#fff',
      fontFamily: 'Montserrat, sans-serif',
      fontSize: '13px',
      fontWeight: 600,
      borderRadius: '8px',
    },
  },
}

const organizationJsonLd = JSON.stringify(organizationSchema())

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Skip ClerkProvider at build time when credentials aren't set yet.
  // Auth features (UserButton, sign-in) require a real key at runtime.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <html lang="en">
        <body>
          {children}
          <Toaster {...toasterProps} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
        </body>
      </html>
    )
  }

  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en">
        <body>
          {children}
          <Toaster {...toasterProps} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
        </body>
      </html>
    </ClerkProvider>
  )
}
