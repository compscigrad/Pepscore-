# Pepscore Lab — Architecture Diagrams

Companion to `docs/Architecture.md` (invoice-module-scoped) and `docs/CaseStudy.md` (full narrative history). This document holds system-level Mermaid diagrams for the ten flows tracked as a standing documentation requirement. Every node and edge below is grounded in real route paths, real function/model names, and real file locations as of commit `13ebf90` (diagrams 3 and 5 updated 2026-08-19: the Finance P1 sprint, the P0 verification pass's `deletedAt` fix, and the Stripe fee-reconciliation hardening pass — real balance-transaction fees, the `computeNetSettlement()` refund-bug fix, and the `markOrderPaid → FinanceExpense` bridge; all other diagrams unchanged since `72a5baf` — none of this work altered the Customer Journey, Admin Operating System, Fulfillment, AI Intelligence, Auth/RBAC, Webhook/Automation, Deployment, or Domain/Launch flows) — see the file path noted under each diagram for where to verify it directly. This is a living document: extend it, don't replace it, whenever a diagrammed flow changes materially.

---

## 1. Customer Journey

Grounded in: `app/page.tsx`, `app/products/[slug]/page.tsx`, `app/categories/[slug]/page.tsx`, `app/search/page.tsx`, `app/research/page.tsx`, `app/checkout/page.tsx`, `app/account/**`, `lib/cart-store.ts`.

```mermaid
flowchart TD
    A[Homepage] --> B[Category Browse /categories/slug]
    A --> C[Predictive Search /search]
    A --> D[Product Detail /products/slug]
    B --> D
    C --> D
    A -.optional, flag-gated.-> R["/research — Pepscore Intelligence\n(AI_FEATURE_ENABLED)"]
    D --> E{Sell unit selector}
    E -->|Standard Case| F[Add to Cart]
    E -->|Single Vial, where eligible| F
    F --> G[Cart Sidebar — lib/cart-store.ts]
    G --> H["/checkout\n(gated: STOREFRONT_CHECKOUT_ENABLED)"]
    H --> I[Stripe Checkout Session]
    I --> J[Order created, PENDING]
    J --> K[Stripe webhook confirms payment]
    K --> L[Order PAID, inventory deducted]
    L --> M[Order Confirmation email]
    A --> N[Client Sign In — Clerk]
    N --> O[/account — Customer Portal/]
    O --> P[Orders / Invoices / Tracking / Payment Methods]
    O --> Q[Buy Again / Reorder All -> Cart]
```

Notes: `/checkout` and live payment collection are engineering-complete but not publicly activated (`STOREFRONT_CHECKOUT_ENABLED` unset in production) — the diagram reflects the built path, not current activation state. `/research` is similarly flag-gated and returns `notFound()` when `AI_FEATURE_ENABLED` is off.

---

## 2. Admin Operating System

Grounded in: `components/admin/AdminNav.tsx` (the live navigation source of truth), `app/admin/**`.

```mermaid
flowchart LR
    NAV[AdminNav.tsx] --> OV[Overview: Dashboard]
    NAV --> SALES[Sales]
    SALES --> INV["Direct & Manual Sales\n/admin/invoices"]
    SALES --> ORD["Online Storefront Orders\n/admin/orders"]
    NAV --> CUST[Customers]
    CUST --> CL["Customers & Leads\n/admin/customers"]
    CUST --> PR["Portal Adoption\n/admin/portal-rollout"]
    CUST --> IR["Identity Review\n/admin/identity-review"]
    CUST --> IQ["Intake Queue\n/admin/intake-queue"]
    NAV --> CAT[Catalog]
    CAT --> PM["Product Master\n/admin/catalog/product-master"]
    CAT --> INVT["Inventory & Pricing\n/admin/inventory"]
    CAT --> PROMO["Promotions\n/admin/promotions"]
    NAV --> FUL["Fulfillment Command Center\n/admin/fulfillment"]
    NAV --> FIN["Finance\n/admin/finance (11 tabs)"]
    NAV --> AI[Intelligence]
    AI --> SD["Search Demand\n/admin/intelligence/search"]
    AI --> PE["Product Engagement\n/admin/intelligence/products"]
    AI --> AIST["AI Control Panel\n/admin/intelligence/ai-status"]
    NAV --> SET[Settings]
    SET --> S1[Invoice / Discounts / Fulfillment]
    SET --> S2[Payments / Notifications]
    SET --> S3[Email Templates / First-Order Offer]

    subgraph AUTH["Every route above"]
      RBAC["requireAdmin() / isCurrentUserAdmin()\nlib/auth/rbac.ts"]
    end
    OV & INV & ORD & CL & PR & IR & IQ & PM & INVT & PROMO & FUL & FIN & SD & PE & AIST & S1 & S2 & S3 -.enforced by.-> RBAC
```

Notes: 76 admin API routes and 29 admin pages are covered by two independent automated regression tests (`adminAuthCoverage.test.ts`, `adminPageAuthCoverage.test.ts`) that scan for a real `requireAdmin()`/`isCurrentUserAdmin()` call rather than trusting convention.

---

## 3. Commerce / Payment Flow

Grounded in: `app/api/checkout/route.ts`, `lib/paymentProviders/` (`PaymentProviderAdapter`), `app/api/webhooks/stripe/route.ts`, `lib/invoices.ts` (`recordPayment`).

```mermaid
flowchart TD
    subgraph Storefront
      A[Checkout submit] --> B["POST /api/checkout\nserver re-resolves prices from DB, never trusts client"]
      B --> C["OrderReservation created\n(transactional inventory hold)"]
      C --> D["Stripe Checkout Session\n(idempotencyKey = order.id)"]
    end
    subgraph Manual
      E[Admin builds Invoice] --> F["InvoiceBuilder\nline items, discounts, arrangement"]
      F --> G["recordPayment() — lib/invoices.ts"]
    end
    D --> H["Stripe webhook\napp/api/webhooks/stripe/route.ts\n(signature-verified)"]
    H -->|checkout.session.completed| I["markOrderPaid\ngetRealStripeFee() — real balance_transaction,\nnever the published-rate estimate\n(fallback flags stripeFeeIsEstimated)"]
    H -->|async_payment_succeeded/failed — ACH| I
    H -->|charge.refunded| J[PaymentProviderAdapter reconciler]
    H -->|charge.dispute.created| J
    H -->|checkout.session.expired| K[Release OrderReservation]
    I --> L[Order.status = PAID, inventory deducted]
    G --> M["PaymentArrangement /\nInstallment schedule"]
    J --> N[Payment.status updated: REFUNDED/DISPUTED]
    L --> O[Order Confirmation email]
    G --> P["Invoice status recomputed\n(Pending/Partial/Paid, derived not stored)"]
    F -.item-level refund.-> Q["requestLineItemRefunds()\nlib/refunds.ts — proportional discount allocation"]
```

Notes: card, ACH, Cash App Pay, and PayPal route through the same `PaymentProviderAdapter`; storefront checkout activation is a separate switch (`STOREFRONT_CHECKOUT_ENABLED`) from key configuration itself.

---

## 4. Fulfillment Flow

Grounded in: `lib/fulfillment/gate.ts` (`checkFulfillmentEligibility`), `lib/fulfillment/labels.ts`, `lib/fulfillment/commandCenter.ts` (`deriveFulfillmentBucket`), `lib/shipments/primary.ts` (`getPrimaryShipment`), `app/api/webhooks/shippo/route.ts`, `app/api/cron/poll-tracking/route.ts`. Updated 2026-08-19 for the direct-sales/admin parity audit's `SELF_DELIVERY` bucket fix (`351661a`).

```mermaid
flowchart TD
    A[Invoice reaches Paid / has active Payment Arrangement] --> B{checkFulfillmentEligibility\nlib/fulfillment/gate.ts}
    B -->|eligible| C[Create Shipping Label]
    B -->|not eligible| D[Manual override — attributed, logged]
    D --> C
    C --> E["SHIPPO_PURCHASING_ENABLED?\n(independent of key validity)"]
    E -->|off| F[Blocked — Trust & Safety review pending]
    E -->|on| G["purchaseShippingLabelForInvoice()\nShippo rate-shop + buy"]
    G --> H["New Shipment row\n(true one-to-many under Invoice)"]
    H --> I["getPrimaryShipment()\nderives current, never a stored pointer"]
    I --> J[Sell-unit-level fulfillment status\nReady to Ship / Produced to Order]
    K["Shippo webhook\n(shared-secret, timing-safe compare)"] --> L[TrackingEvent — deduped by shipmentId+eventHash]
    M["poll-tracking cron\n(daily, 4h polling fallback)"] --> L
    L --> N[InvoiceActivityLog]
    L --> O["alertTypeForBucket()\nlib/fulfillment/alerts.ts"]
    O -->|shipment on cancelled/refunded invoice| P[REFUNDED_AFTER_SHIPMENT]
    O -->|normal exception| Q[CARRIER_EXCEPTION]
    L --> R[Customer notification — if enabled per invoiceSettings]
    S["Admin sets legacy carrier = HAND_DELIVERY/\nPICKUP/COURIER/OTHER (no trackable Shipment\never expected — Shipment.trackingNumber\nis required, non-nullable)"] --> T{"deriveFulfillmentBucket()\nno Shipment row?"}
    T -->|non-trackable carrier| U["SELF_DELIVERY bucket\n(excluded from ACTIONABLE_BUCKETS —\na resolved state, not a missing one)"]
    U -.auto-resolves any stale.-> O
    U --> V[Portal + email render\ndelivery-method language,\nnever a broken tracking CTA]
```

---

## 5. Financial Data Flow

Grounded in: `lib/finance/*.ts`, `docs/finance/PEPSCORE-FINANCIAL-ARCHITECTURE.md`. Updated 2026-08-19 for the Finance P1 sprint (`estimatedTax.ts`, the QuickBooks/Xero export sheet), the P0 verification pass's `deletedAt` fix (`600af53`/`fde75da`/`6579ba3`), the Stripe fee-reconciliation hardening pass (`13ebf90`) — real balance-transaction fees, the `computeNetSettlement()` refund-bug fix, and the `markOrderPaid → FinanceExpense` bridge — and the direct-sales parity audit's Order-side shipping-postage bridge and InvoicePayment fee-parity closure (`351661a` and this same-day follow-up).

```mermaid
flowchart TD
    STRIPE["Stripe balance_transaction\n(real fee/net — getRealStripeFee())"] -.-> PAY
    subgraph Canonical["Canonical models (never duplicated)"]
      INV[Invoice / InvoiceItem]
      ORD[Order / OrderItem]
      PAY["Payment / InvoicePayment\n(stripeFee/netAmount real by default;\nstripeFeeIsEstimated flags the rare fallback)"]
      DISC[InvoiceDiscount / PromotionCode]
      REF[InvoiceRefund]
      LEDG["InventoryLedgerEntry\n(DAMAGE_LOSS)"]
      PURCH[InventoryPurchase — COGS]
      EXP[FinanceExpense]
      OWNT[OwnerTransaction]
      BTP["BusinessTaxProfile\n(singleton — incl. estimatedTaxRatePercent)"]
    end
    PAY -.markOrderPaid mirrors the real fee.-> EXP2["FinanceExpense\n(category PAYMENT_PROCESSING,\nidempotent on paymentIntentId)"]
    EXP2 --> EXP
    SHIP["Shippo label purchase\n(Invoice-side lib/fulfillment/labels.ts\nOrder-side api/shipping/labels)"] -.createExpenseIdempotent, keyed on Shippo label id.-> EXP3["FinanceExpense\n(category SHIPPING_POSTAGE,\nboth channels — same pattern)"]
    EXP3 --> EXP
    IPAY["InvoicePayment\n(admin-recorded; stripePaymentIntentId\noptional, admin-supplied — no live\nPaymentIntent is ever created here)"] -.getRealStripeFee, never estimated.-> EXP4["FinanceExpense\n(category PAYMENT_PROCESSING,\nidempotent on PaymentIntent id)"]
    EXP4 --> EXP
    Canonical --> REPORTS["lib/finance/reports.ts\nDashboard, discounts, refunds, inventory loss, vendor spend"]
    Canonical --> TAX["lib/finance/salesTax.ts\n(currently $0 — nothing collects tax)"]
    Canonical --> RECON["lib/finance/stripeReconciliation.ts\nMATCHED/PARTIAL/MISMATCH/PENDING\ncomputeNetSettlement() always subtracts refunds"]
    REPORTS --> PL["lib/finance/profitLoss.ts\n(pure composition — Revenue -> COGS -> Gross Profit -> Op. Profit)"]
    TAX --> PL
    REPORTS --> MS["monthlySummary.ts\n(per-month Book Profit)"]
    Canonical --> V1099["lib/finance/vendors1099.ts\n(TIN last-4 only)"]
    RECON --> F1099K["form1099k.ts\nprocessor gross vs. book gross"]
    MS & BTP --> ETAX["estimatedTax.ts (P1)\ncomputeMonthBookProfit() x owner flat rate\n'Estimate only — not tax advice' always shown"]
    PL & MS & RECON & V1099 & F1099K --> DQ["dataQualityFlags.ts\n(surfaced for review, never auto-corrected;\nincl. ORDER_WITHOUT_PAYMENT, STRIPE_FEE_ESTIMATED)"]
    PL & MS & RECON & V1099 & F1099K --> EXPORT["export.ts — 14-sheet XLSX/CSV\n(pure composition, zero duplicated calc)\n+ buildQuickBooksXeroExpenseSheet (P1)\nno paid API connection required"]
    INV -.isTestData AND deletedAt.-> EXCL["Test/rehearsal + soft-deleted records\nexcluded from every revenue-recognizing query\n(closed a live $1.00 contamination, 6579ba3)"]
    EXP -.testDataExclusion helper.-> EXCL2["FinanceExpense linked to a test\ninvoice/order also excluded"]
    EXCL --> REPORTS
    EXCL --> PL
    EXCL2 --> REPORTS
```

---

## 6. AI Intelligence Pipeline

Grounded in: `lib/ai/gate/pipeline.ts` (`runAiPipeline`), `lib/ai/policy/`, `lib/ai/retrieval/`, `lib/ai/providers/`, `app/api/ai/intelligence/route.ts`.

```mermaid
flowchart TD
    A["Request\n(compare / discover / explain / ask)"] --> B["Rate limiter\nlib/ai/gate/rateLimiter.ts"]
    B --> C["Input Policy Gate\nlib/ai/policy/engine.ts"]
    C -->|classifier: ALLOW| D
    C -->|classifier: REFUSE| X1["Refused — logged to AiComplianceEvent\nnever reaches retrieval or a model"]
    C -->|classifier: ESCALATE / UNKNOWN / low-confidence| X2["Escalated to Safety Review Queue\n(admin mark-reviewed action)"]
    D["Retrieval\n(role-scoped: ANONYMOUS=Tier1, CLIENT=Tier1-2, ADMIN=all)"] --> E["Tier1CatalogRetrieval\nwraps rankSearch(), plus a\nnatural-language fallback adapter"]
    D --> F["Tier 2/3 fixtures\n(in-memory; no curated corpus yet)"]
    E --> G["retrievalSanitizer.ts\nuntrusted-content scan"]
    F --> G
    G -->|source flagged JAILBREAK/PROMPT_INJECTION| H[Source dropped entirely — no partial include]
    G -->|clean| I["buildRetrievalContext()\nprepended as labeled untrusted system message"]
    I --> J{"buildProviderRouterFromConfig()\nAI_LIVE_MODEL_ENABLED?"}
    J -->|off / no credential / no approved route| K["Fail closed: NOT_CONFIGURED / UNAVAILABLE\nzero network calls"]
    J -->|on| L["ProviderRouter\nprimary -> fallback -> safe failure"]
    L --> M["AiGatewayProvider\nzeroDataRetention=true per request"]
    M -->|primary fails| N["Fallback provider\n(genuinely distinct: Anthropic vs Google)"]
    M --> O["Output Validation\nPASS / REWRITE / REFUSE / ESCALATE"]
    N --> O
    O --> P["Response + citations\n(citations array always present, empty if no retrieval)"]
    P --> Q["AiUsageEvent + AiComplianceEvent logged\n(structured metadata only, never raw prompt text)"]
```

---

## 7. Auth / RBAC

Grounded in: `lib/auth/rbac.ts`, `lib/portalAuth.ts` (Customer Portal boundary), `middleware.ts`, `lib/ai/permissions/roles.ts`.

```mermaid
flowchart TD
    A[Request arrives] --> B["Clerk session\nauth() / currentUser()"]
    B -->|no session| C[ANONYMOUS]
    B -->|session exists| D{User.role in DB}
    D -->|ADMIN| E["requireAdmin() succeeds\nfull admin surface"]
    D -->|no ADMIN role| F[CLIENT]
    F --> G{"Customer.userId linked?"}
    G -->|yes| H["Customer Portal boundary\nlib/portalAuth.ts — every query scoped\nto session's Customer.id, never a client-supplied id"]
    G -->|no| I[Storefront-only authenticated user]
    D -.bootstrap path, one-time only.-> J["clerkUserId === ADMIN_CLERK_USER_ID?\n(legacy env var — promotes/creates User.role=ADMIN\non first request, then dead code for that identity)"]
    J --> D
    E --> K["lib/ai/permissions/roles.ts\nANONYMOUS/CLIENT/ADMIN mapped onto\nthis same rbac.ts foundation — no parallel system"]
    F --> K
    C --> K
    E -.regression guard.-> L["adminAuthCoverage.test.ts (76 API routes)\nadminPageAuthCoverage.test.ts (29 pages)"]
```

---

## 8. Webhook / Automation Architecture

Grounded in: `app/api/webhooks/*`, `app/api/cron/*`, `vercel.json`.

```mermaid
flowchart LR
    subgraph Webhooks["Inbound webhooks (signature/secret verified)"]
      W1["/api/webhooks/stripe\n(Stripe signature)"]
      W2["/api/webhooks/shippo\n(shared secret, timing-safe compare)"]
      W3["/api/webhooks/clerk\n(Svix signature)"]
      W4["/api/webhooks/twilio\n(request signature)"]
    end
    subgraph Crons["Vercel Cron (all daily-or-slower — Hobby-tier constraint learned the hard way)"]
      C1["archive-invoices — 06:00"]
      C2["poll-tracking — 06:00"]
      C3["portal-invite-reminders — 14:00"]
      C4["portal-invite-rollout — 15:00"]
      C5["promotion-campaign-schedule — 16:00"]
      C6["release-abandoned-reservations — 07:00"]
      C7["first-order-offer-reminders\n(built, safety-gated, NOT registered)"]
    end
    W1 --> A1[Payment/Order state reconciliation]
    W2 --> A2[TrackingEvent + fulfillment status]
    W3 --> A3["User row sync (Clerk -> Prisma)"]
    W4 --> A4[SMS opt-in/opt-out + delivery status]
    C1 --> A5["Paid -> Archived transition\n(paidAt as live countdown anchor)"]
    C2 --> A2
    C3 & C4 --> A6["Portal invite rollout\ndry-run default, allowlist, per-run cap"]
    C5 --> A7[Promotion Campaign draft->scheduled->active->retired]
    C6 --> A8["Release 25h-old unpaid\ncheckout reservations"]
    C7 -.dormant.-> A9["Day-2/day-5 first-order reminder\n(reuses reminderSafety.ts engine)"]
```

---

## 9. Deployment / Infrastructure

Grounded in: `docs/launch/PEPSCORE-SOFT-LAUNCH-READINESS.md`, `docs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md`, `vercel.json`, `app/layout.tsx`.

```mermaid
flowchart TD
    subgraph Team["Vercel — AOAI team (Pro plan)"]
      P1["pepscore\n(operational app — this repo)"]
      P2["pepscore-landing\n(marketing site — separate repo/project)"]
    end
    DEV[Local development] -->|git push| GH["GitHub — master branch"]
    GH -->|Git-integrated deploy| PREV[Preview deployment]
    GH -->|push to master| PROD["Production deployment\npepscore-aoai.vercel.app"]
    subgraph EnvScoping["Environment-scoped configuration"]
      E1[Preview env vars]
      E2[Production env vars]
      E3["Preview + Production share\none Neon database (deliberate)"]
    end
    PREV --> E1
    PROD --> E2
    E1 & E2 --> E3
    subgraph AIGateway["Vercel AI Gateway (team-scoped credential)"]
      G1["AI_GATEWAY_API_KEY\n(AOAI Pro plan — ZDR-eligible,\nreplacing the pre-transfer Hobby-team key)"]
    end
    PROD -.live model calls, when AI_LIVE_MODEL_ENABLED.-> G1
    PROD --> NEON["Neon Postgres\n(Prisma, 67 models)"]
    PROD --> CRON["6 registered Cron jobs\n(vercel.json)"]
    PROD -.not yet.-> DOMAIN["pepscorelab.com\n(still owned by pepscore-landing;\ncutover checklist prepared, not executed)"]
```

---

## 10. Domain / Launch Architecture

Grounded in: `docs/launch/PEPSCORE-SOFT-LAUNCH-READINESS.md`, `docs/launch/OWNER-LAUNCH-CHECKLIST.md`, `docs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md`.

```mermaid
flowchart TD
    A["pepscorelab.com / www.pepscorelab.com"] -->|currently points to| B["pepscore-landing\n(marketing site)"]
    C["pepscore-aoai.vercel.app"] -->|current real serving domain for| D["pepscore\n(operational app — this repo)"]
    E["Domain Cutover Checklist\ndocs/assets/audits/PEPSCORE-DOMAIN-CUTOVER-CHECKLIST.md"] -.prepared, not executed.-> F["Future: pepscorelab.com\nrepointed at the operational app,\nor a subdomain split"]
    G["NEXT_PUBLIC_APP_URL"] --> H["sitemap.ts / robots.ts / structuredData.ts /\nlayout.tsx metadataBase\n— all four normalized to one\nconsistent fallback (2026-08-18 fix)"]
    subgraph Launch["Soft-launch readiness dashboard"]
      GREEN["GREEN — verified, launch-ready"]
      YELLOW["YELLOW — owner decision required\n(OWNER-LAUNCH-CHECKLIST.md)"]
      RED["RED — genuine blocker: NONE FOUND"]
      BLUE["BLUE — intentionally deferred"]
    end
    D --> Launch
    YELLOW --> Y1["Y1: flip STOREFRONT_CHECKOUT_ENABLED"]
    YELLOW --> Y15["Y15: sales-tax decision"]
    YELLOW --> Y16["Y16: checkout-shipping decision"]
    YELLOW --> Y17["Y17: final live-transaction rehearsal"]
```

---

## Maintaining this document

Each diagram cites the real files it was drawn from — when those files change materially, update the diagram in the same sprint, per the standing rule in `docs/CaseStudy.md`'s "Continuous Update Rule." Do not add a node or edge without first confirming it against the cited source; a diagram that looks plausible but wasn't checked against real code is worse than no diagram.
