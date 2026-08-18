# Pepscore Lab — Owner Launch Checklist

**One list, shortest possible, prioritized.** Everything not on this list has already been handled autonomously or is genuinely deferred to post-launch (see `PEPSCORE-SOFT-LAUNCH-READINESS.md` for the full GREEN/YELLOW/RED/BLUE picture, and `docs/PendingOwnerActions.md` for full detail on every item). Supporting documents for the six starred items are in this same folder.

## Tier 1 — before real storefront checkout goes live

1. **Decide: sales tax.** Read `SalesTaxDecision.md`. If yes, set up Stripe Tax registrations — the code change is a ~15-minute task, already documented and ready.
2. **Decide: checkout shipping.** Read `CheckoutShippingOptions.md` — keep it free-for-everyone (zero work, just confirm homepage copy still matches), or build real Shippo-rate charging at checkout (can be built/tested now, independent of the Shippo Trust & Safety timeline).
3. **Get Stripe live.** Read `StripeShippoLiveReadiness.md` → Stripe section. Request live keys, confirm RUO merchant-category eligibility with Stripe, paste keys + webhook secret into Vercel, flip `STOREFRONT_CHECKOUT_ENABLED`.
4. **Sign off on legal pages.** Read `LegalComplianceStatus.md`. All five pages (`/terms /privacy /shipping /returns /lab-results`) are already fully drafted and live — just fill in the Governing Law blank in Terms, confirm the COA claim is accurate, and approve (or send to counsel first).
5. **Run the transaction rehearsal.** Follow `FinalTransactionRehearsal.md` once steps 1-4 are done, before telling anyone checkout is live.

## Tier 2 — shipping backlog (blocked on a third party, not on you)

6. **Shippo Trust & Safety review** is already submitted and pending on Shippo's side — nothing to do but wait, unless they've asked for something. Once approved: flip `SHIPPO_PURCHASING_ENABLED`, buy one real internal test label, then clear the 5 paid orders currently stuck in "Label Needed" (oldest is 25+ days old — Admin → Fulfillment Command Center).

## Tier 3 — worth doing before wide traffic, not launch blockers

7. **Add the missing Resend DKIM record.** Confirmed by direct DNS lookup this session: `send.pepscorelab.com`'s SPF and bounce-handling MX are correctly in place, but the `resend._domainkey.pepscorelab.com` CNAME is missing. Check the Resend Dashboard for `pepscorelab.com`'s exact required DKIM value and add it — without it, mail authentication is weaker and more likely to land in spam even after the domain otherwise verifies.
8. **Confirm Clerk production keys** (currently development keys — works fine in normal browsers, may fail in strict-privacy contexts). Clerk Dashboard, 5-minute check.
9. **One live click-through**: sign up as a real (non-admin) customer and confirm `/account/orders` + `/account/tracking` render correctly, and a quick look at the site on your own phone. Both are code-verified but this session's tooling couldn't produce a live browser confirmation for either.

## Tier 4 — explicitly not blockers, defer freely

- PayPal enablement, Clerk phone/MFA, Neon backup-window confirmation, price-matching guarantee mechanics, Individual Vial pricing formula, master pricing report send, PortalRolloutSettings bulk-invite activation, Twilio SMS registration, Finance COGS backfill. Full detail on each in `docs/PendingOwnerActions.md` — none of them stop you from taking real orders.

---

**Everything else** — code correctness, data integrity, security, the two real defects found and fixed this session (Shippo purchasing gate, Stripe idempotency), the domain-URL fix, and 11 leftover test invoices cleaned out of your real Invoices list — is done. Full detail in `PEPSCORE-SOFT-LAUNCH-READINESS.md`.
