import { SignIn } from '@clerk/nextjs'

// This one page is shared by both customer and admin sign-in (the admin has
// no separate login flow — admin status is resolved per-request from the
// database via lib/auth/rbac.ts's requireAdmin(), with ADMIN_CLERK_USER_ID
// used only as a one-time bootstrap for the first admin's User row).
// fallbackRedirectUrl (not forceRedirectUrl) so
// an explicit ?redirect_url=... query param — which the landing page's
// "Customer Sign In" CTA and the admin's own bookmarked links can each set —
// always wins; /account is only the default when nothing else was
// specified.
//
// signUpUrl="/sign-up" is REQUIRED (2026-08-13 RUO-gate-bypass fix):
// without it, this <SignIn>'s own "Don't have an account? Sign up" link
// resolved to Clerk's externally-hosted Account Portal
// (https://<instance>.accounts.dev/sign-up) -- a full navigation off this
// domain entirely, confirmed live via Playwright, completely bypassing
// app/sign-up/[[...sign-up]]/page.tsx's RuoSignupGate. Never remove this
// prop.
export default function SignInPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <SignIn fallbackRedirectUrl="/account" signUpUrl="/sign-up" />
    </div>
  )
}
