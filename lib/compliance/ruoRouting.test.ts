// Regression guard for the RUO-gate-bypass fix (2026-08-13). The bug: every
// entry point into Clerk account creation must converge on
// app/sign-up/[[...sign-up]]/page.tsx's server-side RuoSignupGate check --
// but <SignInButton mode="modal">'s own "Don't have an account? Sign up"
// link is hard-coded in @clerk/clerk-react to swap the modal to Clerk's
// native, un-gated sign-up UI via internal virtual routing, with no real
// navigation and no way to point it at our route through any prop. The
// dedicated /sign-in page's <SignIn> component had the same root cause in
// a different shape: with no explicit signUpUrl, its "Sign up" link
// resolved to Clerk's externally-hosted Account Portal instead of this
// app's own /sign-up route. Both were confirmed live via Playwright, not
// just read from source -- see the sprint's completion report for the
// exact reproduction. This test is a static source guard, not a
// replacement for that live verification: it fails loudly if the specific
// configuration the fix depends on is ever reverted, without needing a
// full browser-test harness this repo doesn't otherwise have.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf-8')

// Strips // and /* */ comments before matching -- several of these files'
// own explanatory comments quote the exact JSX/prop strings being asserted
// on (that's the whole point of documenting the fix in place), which would
// otherwise produce false passes/failures against comment prose instead of
// real code. Good enough for this file set (no strings containing `//` or
// `/*` in the props being checked).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

describe('RUO signup gate routing (regression guard)', () => {
  it('no SignInButton anywhere uses mode="modal" -- it cannot be gated', () => {
    const src = stripComments(read('components/storefront/ClerkAuthButtons.tsx'))
    expect(src).not.toMatch(/<SignInButton\s+mode=["']modal["']/)
    // Both real usages must be present and explicitly "redirect".
    const redirectCount = (src.match(/<SignInButton\s+mode="redirect"/g) ?? []).length
    expect(redirectCount).toBeGreaterThanOrEqual(2)
  })

  it('ClerkProvider declares explicit signInUrl and signUpUrl', () => {
    const src = stripComments(read('app/layout.tsx'))
    expect(src).toMatch(/<ClerkProvider[^>]*signInUrl="\/sign-in"/)
    expect(src).toMatch(/<ClerkProvider[^>]*signUpUrl="\/sign-up"/)
  })

  it('the dedicated /sign-in page declares signUpUrl explicitly', () => {
    const src = stripComments(read('app/sign-in/[[...sign-in]]/page.tsx'))
    expect(src).toMatch(/<SignIn[^>]*signUpUrl="\/sign-up"/)
  })

  it('/sign-up still conditionally renders RuoSignupGate before <SignUp/>', () => {
    const src = stripComments(read('app/sign-up/[[...sign-up]]/page.tsx'))
    expect(src).toMatch(/<RuoSignupGate\s*\/>/)
    expect(src).toMatch(/<SignUp\b/)
    // The gate branch must return before <SignUp/> is reached in source
    // order -- a cheap proxy for "gated, not both rendered unconditionally".
    expect(src.indexOf('<RuoSignupGate')).toBeLessThan(src.indexOf('<SignUp'))
  })
})
