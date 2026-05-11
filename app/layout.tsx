// Root layout — wraps all routes with Clerk auth provider and global styles
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore.com'),
  title: 'Pepscore — Holistic Research Peptides',
  description:
    'Precision-grade research peptides with independently verified purity above 98%. For Research Use Only.',
  keywords: ['research peptides', 'semaglutide', 'tirzepatide', 'NAD+', 'epithalon', 'RUO'],
  openGraph: {
    title: 'Pepscore — Holistic Research Peptides',
    description: 'Pharmaceutical-quality research peptides. ≥98% purity. For Research Use Only.',
    images: [{ url: '/images/ALL.png' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#1A1A1A',
                color: '#fff',
                fontFamily: 'Montserrat, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
