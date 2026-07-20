// Shared brand constants for both PDF documents (and referenced by the live
// HTML preview) so the two PDFs and the on-screen preview never drift into
// different-looking products. Values mirror tailwind.config.ts's gold/dark/
// gray palette — see docs/UIUXGuidelines.md for the full token table.
//
// Logo path is a configurable placeholder, not hardcoded logic: swap the
// file at public/images/logo.png (or point LOGO_PATH elsewhere) and both
// PDFs pick it up automatically — no code change required.
//
// Loaded as a base64 data URI rather than a bare filesystem path: react-pdf's
// Image component resolves string `src` values through its own fetch-based
// loader (even for local paths) and silently fails to embed the image if
// that fetch fails in a server/Node context. A data URI sidesteps that
// resolution path entirely.
import fs from 'fs'
import path from 'path'

export const BRAND = {
  companyName: 'Pepscore Lab',
  tagline: 'Precision Peptide Solutions',
  colors: {
    gold: '#C49A1A',
    goldDark: '#9E7C15',
    goldLight: '#E8C84A',
    cream: '#FAFAF5',
    dark: '#1A1A1A',
    g700: '#424242',
    g500: '#757575',
    g300: '#BDBDBD',
    g100: '#F5F5F0',
    white: '#FFFFFF',
  },
  fonts: {
    // @react-pdf/renderer needs registered TTF/OTF files for custom fonts;
    // Montserrat/Libre Franklin aren't bundled with the app, so PDFs use
    // Helvetica (a react-pdf built-in) rather than adding font files just
    // for this. Close enough in weight/feel; revisit if brand fidelity in
    // the PDF specifically becomes a priority.
    heading: 'Helvetica-Bold',
    body: 'Helvetica',
  },
  // INSERT PEPSCORE LOGO PATH HERE — replace to rebrand without touching
  // MasterInvoiceDocument.tsx / RecipientReceiptDocument.tsx.
  logoPath: loadLogoDataUri(path.join(process.cwd(), 'public', 'images', 'logo.png')),
} as const

function loadLogoDataUri(filePath: string): string | undefined {
  try {
    return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`
  } catch {
    // Missing logo shouldn't crash PDF generation — DocumentHeader skips
    // rendering the <Image> when this is undefined.
    return undefined
  }
}
