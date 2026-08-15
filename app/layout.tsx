// Root layout — wraps all routes with Clerk auth provider and global styles.
// ClerkProvider is skipped when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is absent
// so the site builds cleanly before Clerk is configured.
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'react-hot-toast'
import { clerkAppearance } from '@/lib/clerkAppearance'
import { organizationSchema, websiteSchema } from '@/lib/storefront/structuredData'
import { AttributionCapture } from '@/components/storefront/AttributionCapture'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscorelab.com'),
  title: 'Pepscore Lab — Holistic Research Peptides',
  description:
    'Precision-grade research peptides with independently verified purity above 98%. For Research Use Only.',
  keywords: ['research peptides', 'semaglutide', 'tirzepatide', 'NAD+', 'epithalon', 'RUO'],
  alternates: { canonical: '/' },
  // Social/link-preview image (2026-08-14) -- pepscore-social-preview-v2.jpg
  // is the owner-supplied banner asset, installed unaltered (no crop/
  // resize/re-encode) under a new versioned filename rather than
  // overwriting pepscore-hero-v2.png in place, so no CDN/social-platform
  // cache of the old filename can serve stale bytes under this one.
  // width/height are the asset's real pixel dimensions (1652x490) --
  // Open Graph consumers use these to lay out the card before the image
  // itself loads, and an inaccurate value is worse than none. The 3.37:1
  // aspect ratio is wider than the ~1.91:1 most platforms optimize for
  // (it's a deliberately wide banner design, not a redesign candidate);
  // some services may crop or letterbox it differently as a result --
  // a genuine platform-rendering tradeoff, not a bug in this metadata.
  openGraph: {
    title: 'Pepscore Lab — Holistic Research Peptides',
    description: 'Pharmaceutical-quality research peptides. ≥98% purity. For Research Use Only.',
    url: '/',
    images: [
      {
        url: '/images/pepscore-social-preview-v2.jpg',
        width: 1652,
        height: 490,
        alt: 'Pepscore Lab — branded research peptide vial lineup',
      },
    ],
    type: 'website',
  },
  // Explicit Twitter/X card -- previously left to Next.js's own openGraph
  // fallback (which does already mirror title/description/image), spelled
  // out explicitly here per the same asset so the two can never reference
  // different images if one block is edited without the other later.
  twitter: {
    card: 'summary_large_image',
    title: 'Pepscore Lab — Holistic Research Peptides',
    description: 'Pharmaceutical-quality research peptides. ≥98% purity. For Research Use Only.',
    images: ['/images/pepscore-social-preview-v2.jpg'],
  },
  // Belt-and-suspenders alongside app/robots.ts's env-based rules -- this
  // covers the meta-tag-level signal too, in case a crawler ignores
  // robots.txt but respects the page's own noindex meta tag.
  robots: process.env.VERCEL_ENV === 'production' ? undefined : { index: false, follow: false },
}

// Global toast styling (react-hot-toast has no Tailwind hook, so these are
// plain inline styles) -- the dark card itself already matched the app's
// `dark` token, but success toasts fell back to the library's default green
// checkmark, inconsistent with every other "positive/terminal" surface in
// the app (e.g. StatusBadge.tsx's gold-accented paid/delivered states).
// Error keeps a red icon -- a real semantic warning, not a brand color, and
// already close to the app's own red-400 error text elsewhere.
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
      border: '1px solid rgba(196,154,26,0.15)',
    },
    success: {
      iconTheme: { primary: '#C49A1A', secondary: '#1A1A1A' },
    },
  },
}

const organizationJsonLd = JSON.stringify(organizationSchema())
const websiteJsonLd = JSON.stringify(websiteSchema())

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Skip ClerkProvider at build time when credentials aren't set yet.
  // Auth features (UserButton, sign-in) require a real key at runtime.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <html lang="en">
        <body>
          <AttributionCapture />
          {children}
          <Toaster {...toasterProps} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
          <Analytics />
        </body>
      </html>
    )
  }

  return (
    // signInUrl/signUpUrl are REQUIRED (2026-08-13 RUO-gate-bypass fix) --
    // explicit, not relying on Clerk's Next.js route auto-detection, which
    // a prior comment in app/sign-up/[[...sign-up]]/page.tsx incorrectly
    // assumed was already working. Confirmed live via Playwright against a
    // real Clerk instance, not assumed from reading the code: without
    // signUpUrl here, the dedicated /sign-in page's own <SignIn>
    // component's "Don't have an account? Sign up" link resolved to
    // Clerk's externally-hosted Account Portal
    // (https://<instance>.accounts.dev/sign-up) instead of this app's own
    // protected /sign-up route. Note this does NOT cover
    // <SignInButton mode="modal">'s own internal "Sign up" transition --
    // see components/storefront/ClerkAuthButtons.tsx for why that needed a
    // separate fix (mode="redirect" instead of "modal").
    <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en">
        <body>
          <AttributionCapture />
          {children}
          <Toaster {...toasterProps} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLd }} />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
