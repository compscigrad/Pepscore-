import { SignUp } from '@clerk/nextjs'

// forceRedirectUrl (not the fallback variant) so a customer arriving via the
// landing page's "Set Up My Account" CTA always lands on /account — which is
// also where self-service resolution (see app/account/page.tsx's NOT_LINKED
// branch) runs for a freshly-created Clerk identity.
export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <SignUp forceRedirectUrl="/account" />
    </div>
  )
}
