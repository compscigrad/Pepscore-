// Reskins Clerk's default light/purple UI (sign-in, sign-up, account
// management, MFA/passkey screens) to match Pepscore's gold-on-black brand
// (tailwind.config.ts's palette, duplicated here as plain hex since Clerk's
// `variables` aren't Tailwind-aware). Only the theme-able surface — colors,
// fonts, spacing, and the primary-button/card styling via `elements` class
// names (Tailwind picks these up normally since this file is scanned by the
// same content globs as any other .ts file under app/). Clerk's own
// "Secured by Clerk" wordmark and "Development mode" badge are a paid-plan
// feature to remove entirely, not something `appearance` can hide — left
// alone here rather than fought with CSS, per "where plan permits."
import type { Appearance } from '@clerk/types'

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#C49A1A',
    colorBackground: '#1A1A1A',
    colorInputBackground: 'rgba(255,255,255,0.05)',
    colorInputText: '#FFFFFF',
    colorText: '#FFFFFF',
    colorTextSecondary: 'rgba(255,255,255,0.6)',
    colorTextOnPrimaryBackground: '#1A1A1A',
    colorDanger: '#F87171',
    colorSuccess: '#C49A1A',
    colorNeutral: '#FFFFFF',
    fontFamily: '"Libre Franklin", sans-serif',
    borderRadius: '10px',
  },
  elements: {
    card: 'shadow-none border border-white/10',
    headerTitle: 'font-heading',
    headerSubtitle: 'text-white/50',
    formButtonPrimary:
      'bg-gold hover:bg-gold-dark text-dark font-heading font-bold normal-case shadow-none',
    footerActionLink: 'text-gold-light hover:text-gold',
    identityPreviewEditButton: 'text-gold-light',
    formFieldInput: 'focus:ring-2 focus:ring-gold/40 focus:border-gold/30',
    otpCodeFieldInput: 'focus:ring-2 focus:ring-gold/40 focus:border-gold/30',
  },
}
