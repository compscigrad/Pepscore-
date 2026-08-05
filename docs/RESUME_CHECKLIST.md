# Resume Checklist

Quick-glance snapshot for restarting work. Full detail lives in `docs/HANDOFF.md`; the paste-ready prompt is `docs/RECOVERY_PROMPT.txt`.

> **Before running the dev server or any local script**: `.env.local` is intentionally not stored in Git. Restore it securely from Vercel's Environment Variables settings (or another approved secret-management source) first — never from a value copied into any doc.

- [ ] **Current branch**: `feature/customer-user-identity-link`
- [ ] **Current PR**: [#42](https://github.com/compscigrad/Pepscore-/pull/42) — open, not merged, 2/2 checks passing, no conflicts
- [ ] **Current development phase**: Phase 2B (Customer Storefront) — first task in progress
- [ ] **Last completed task**: `Customer.userId` identity-link implementation — schema applied to the shared production database, code written, 123/123 tests passing, `tsc`/`eslint`/`next build` all clean, branch pushed, PR opened, Preview deployment Ready
- [ ] **Current blocking item**: Real signed-in acceptance test is paused mid-flight at a **Cloudflare Turnstile "Verify you are human" check** during Clerk sign-up on the PR's Preview deployment (`https://pepscore-git-feature-customer-user-32a4dc-compscigrads-projects.vercel.app/account`) — this step requires a human, not Claude, to complete
- [ ] **Next action after resuming**:
  1. Resume guide-mode walkthrough: complete the Cloudflare Turnstile checkbox, then the Clerk OTP screen (enter fixed test code `424242` — the sign-up email `phase2b-acceptance-test+clerk_test@pepscorelab.com` uses Clerk's dev-mode test-email convention)
  2. Land on `/account` and confirm it renders
  3. Verify the 7 acceptance checks below
  4. Merge PR #42
  5. Propose the next Phase 2B task (shipping estimates — already scoped in `docs/HANDOFF.md` Section 7)
- [ ] **Acceptance criteria remaining** (all unverified as of this checkpoint):
  - [ ] Clerk `User` row exists for the test sign-up
  - [ ] Exactly one `Customer` record is linked to that `User`
  - [ ] `Customer.userId` populated correctly on that record
  - [ ] No duplicate `Customer` records created
  - [ ] Resolution logic is idempotent (revisiting `/account` doesn't change anything)
  - [ ] Pre-existing intake-only `Customer` ("TEST DeleteMe", `userId = null`) remains unaffected
  - [ ] `/account` page loads correctly using the linked `Customer` record
- [ ] **Estimated time remaining for this PR**: 15–30 minutes — the code, tests, and build are already done; what's left is a short human-assisted browser walkthrough (a few guided clicks) plus a handful of read-only database checks and the merge itself. No further coding is anticipated for this PR.

## After this PR merges

- [ ] Clean up the test Clerk account (`phase2b-acceptance-test+clerk_test@pepscorelab.com`) and its linked `Customer` row
- [ ] Confirm Production still serves `/admin/invoices` and `/account` correctly post-merge
- [ ] Begin Phase 2B Task 2 (shipping estimates) — do not start this before the above is done
