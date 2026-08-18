# Legal / Compliance Surfaces — Actual Status

**Correction to this session's earlier Phase 1 finding**: the initial audit (delegated to a research agent) described the Terms/Privacy/Shipping/Returns pages generically as "legal pages... referencing contact@pepscorelab.com consistently" without flagging that they are not placeholders — direct code inspection shows all four (plus Lab Results/COA) are fully drafted, live, and already linked from the footer (the "Coming soon" fallback in `Footer.tsx` is dead code today — every link has a real destination). This document replaces the earlier, overstated "draft policy copy" item with what's actually true.

## What already exists (all confirmed live, 200 OK, on the current domain)

| Page | Route | Status |
|---|---|---|
| Terms of Service | `/terms` | Complete draft, self-marked "OWNER/LEGAL REVIEW REQUIRED" |
| Privacy Policy | `/privacy` | Complete draft, grounded in actual data flows (Clerk/Stripe/Shippo/Resend/Twilio/Vercel named specifically), self-marked "OWNER/LEGAL REVIEW REQUIRED" |
| Shipping Policy | `/shipping` | Complete, matches actual fulfillment behavior (2-5 day processing, ~2 week backorder, lyophilized/no cold-chain, $25 backorder credit) |
| Returns & Refunds | `/returns` | Complete draft, matches actual code behavior (product-integrity no-return-once-shipped policy, 7-day window for wrong/damaged/missing, backorder credit), self-marked "pending final owner approval" |
| Lab Results / COA | `/lab-results` | Complete, "documentation available on request" model (not auto-attached to every order) — the owner's asserted "third-party tested" claim is flagged in `docs/PendingOwnerActions.md` #9 for confirmation against real supplier/lab documentation |

All five are deliberately excluded from search indexing (`robots: { index: false, follow: true }`) until finalized — a correct, safe default that doesn't need to change until sign-off happens.

## What's actually still open (much shorter than originally scoped)

1. **One specific blank in Terms of Service**: the Governing Law section literally reads *"[Governing-law jurisdiction to be confirmed by the business owner against Pepscore Lab's actual registered entity and state of formation before this page is finalized.]"* — needs the owner's actual entity/state info (this environment does not know Pepscore Lab's registered business entity or state of formation, and should not guess).
2. **Attorney/owner sign-off** on all five pages as final, not draft — the content itself is a strong, non-generic starting point (built from real app behavior, not boilerplate), but "OWNER/LEGAL REVIEW REQUIRED" comments remain in the code until that happens.
3. **Confirm the "third-party tested"/COA claim** on the Lab Results page reflects real, current supplier documentation — this is a factual verification only the owner can do, not a copy-writing task.
4. Once reviewed and approved, flip `robots: { index: false }` → indexable on each page (a one-line change per file, held until the owner says the content is final).

## What this environment did NOT do

Did not write new policy copy (unnecessary — real, thoughtful drafts already exist), did not fabricate a governing-law jurisdiction or entity information, did not change indexing status, did not alter any of the five pages' content.

## Recommended owner action (single line for the consolidated checklist)

**Review `/terms`, `/privacy`, `/shipping`, `/returns`, `/lab-results` (all live today) — fill in the Governing Law blank in Terms, confirm the COA claim is accurate, and give final sign-off (or send to counsel first) so indexing can be turned on.**
