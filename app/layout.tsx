// ============================================================
// FILE: app/layout.tsx  (LANDING BRANCH OVERRIDE)
// PURPOSE: Minimal layout — no Clerk/auth, no Toaster, pure static
// BRANCH: landing — DO NOT MERGE to master
// ============================================================

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://pepscorelabs.com'),
  title: 'Pepscore Labs — Launching Soon | Precision Peptide Solutions',
  description:
    'Science. Precision. Performance. Wholesale & retail precision peptide packaging solutions. Launching 2025.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#000', overflowX: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
