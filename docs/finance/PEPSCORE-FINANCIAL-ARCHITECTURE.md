# Pepscore Financial Architecture

**What this is**: internal bookkeeping/reporting infrastructure to support the owner's own understanding of the business and hand a CPA a clean package at tax time. **What this is not**: a certified accounting platform, a tax-filing tool, or a source of legal/tax advice. Nothing in this system files anything, pays anything, or asserts a legal obligation on its own.

## Sources of truth (never duplicated)

| Concept | Canonical model | Notes |
|---|---|---|
| A sale (direct/manual) | `Invoice` / `InvoiceItem` | The real, current sales channel — see [Data Dictionary](./PEPSCORE-FINANCE-DATA-DICTIONARY.md) |
| A sale (storefront checkout) | `Order` / `OrderItem` | Zero rows today — checkout hasn't launched |
| A payment received on an invoice | `InvoicePayment` | Manual recording, no per-transaction Stripe linkage |
| A storefront Stripe payment | `Payment` | Has real Stripe fields (fee, net, payout, settlement) |
| Discounts/credits applied | `InvoiceDiscount`, `PromotionCode` | Read directly, never re-recorded as an expense |
| A completed refund | `InvoiceRefund` | `completedAmount`/`completedAt` are authoritative |
| Inventory loss/shrinkage | `InventoryLedgerEntry` (eventType `DAMAGE_LOSS`) | Cost basis derived, never retail value |
| A stock purchase (COGS) | `InventoryPurchase` | Separate from `FinanceExpense` — never double-counted |
| A general business expense | `FinanceExpense` | The 2026-08-12 sprint's ledger, 13 categories |
| Owner equity movement | `OwnerTransaction` | New (2026-08-18) — contributions/distributions/reimbursements/owner-paid-expenses, explicitly never revenue or an expense |

**Rule enforced throughout this codebase**: every report function in `lib/finance/*.ts` reads from one of the models above. None of them recompute or re-derive a number a canonical model already owns. If a report needs a number that doesn't exist anywhere yet (e.g. sales tax collected), it reads the real field (`Invoice.tax`/`Order.tax`) and reports the real value — including $0 when that's the truth — rather than estimating.

## Stripe processing-fee reconciliation (2026-08-19)

`Payment.stripeFee`/`.netAmount` are populated from Stripe's own real balance transaction on the charge (`lib/stripe.ts`'s `getRealStripeFee()` → `PaymentIntent.latest_charge.balance_transaction`), never estimated from the published card/ACH rate — the published-rate functions (`estimateStripeFee`/`estimateAchFee`) exist only as the documented fallback for the rare case the real figure isn't retrievable at webhook time, and that fallback is always disclosed via `Payment.stripeFeeIsEstimated` (surfaced in the Stripe Reconciliation report/export and as a `STRIPE_FEE_ESTIMATED` data-quality flag), never silently blended with real data.

The fee itself is mirrored into `FinanceExpense` (category `PAYMENT_PROCESSING`, `taxTreatment: OPERATING_EXPENSE`) the moment a storefront order is marked paid, idempotently keyed on the Stripe PaymentIntent id — this is what actually makes a real Stripe fee reach the P&L, monthly summary, and accountant export; `Payment.stripeFee` alone only ever fed the Stripe Reconciliation report. Test/rehearsal orders are automatically excluded from this expense the same way every other `FinanceExpense` row is (`getTestDataExpenseExclusion()`).

Net Settlement (`lib/finance/stripeReconciliation.ts`'s `computeNetSettlement()`) always subtracts `refundedAmount` from gross-minus-fee, regardless of whether the stored `netAmount` came from a real balance transaction or the fallback formula — a real, found-and-fixed bug (the original inline expression used the stored `netAmount` as-is whenever it was set, which silently ignored every refund) is documented in `docs/CaseStudy.md`'s own mini case study for this fix, not just in this architecture note.

Refunded amounts (`InvoiceRefund.completedAmount`, and the storefront-side `charge.amount_refunded` normalization) have always come from Stripe's own real event data, never estimated — confirmed, not assumed. Stripe's real behavior of never returning the original processing fee on a refund is correctly preserved: refund reconciliation (`lib/payments/reconcile.ts`) never modifies `stripeFee`.

## Test-data exclusion

`Invoice.isTestData` / `Order.isTestData` (both `Boolean @default(false)`, added 2026-08-18) exclude non-real transactions from every revenue-recognizing query. This is **distinct from `archivedAt`** — archiving a real, completed invoice is a filing action and does not remove it from financial history; `isTestData` is the only field that means "this was never a real transaction."

Backfilled once, by explicit invoice-number list (never a pattern match against future data), for the 11 "Rehearsal"/"[REHEARSAL] Customer A/B" invoices found in production on 2026-08-18 — leftover from an earlier autonomous session's own regression testing. This fixed a real, quantified reporting bug: the previously-reported revenue figure ($4,978.00) included $1,075.00 from these fake invoices; the corrected figure is $3,903.00 across 18 genuine invoices. See [Data Dictionary](./PEPSCORE-FINANCE-DATA-DICTIONARY.md) for exactly which queries this touches.

## Report layer (`lib/finance/`)

| File | Purpose | Touches DB? |
|---|---|---|
| `reports.ts` | Dashboard metrics, discounts/credits, refunds, inventory loss, vendor spend, per-invoice profitability | Yes |
| `salesTax.ts` | Sales tax ledger (currently $0 everywhere — nothing collects tax yet) | Yes |
| `stripeReconciliation.ts` | Order/Payment vs. Stripe's own fee/settlement/payout data | Yes |
| `profitLoss.ts` | Structures existing metrics into Revenue → COGS → Gross Profit → Operating Profit | No (composes `reports.ts` + `salesTax.ts`) |
| `monthlySummary.ts` | Month-by-month breakdown for a given year | Yes |
| `ownerTransactions.ts` | Owner contribution/distribution/reimbursement CRUD + summary | Yes |
| `taxProfile.ts` | Singleton business tax/entity settings | Yes |
| `taxReminders.ts` | Configurable deadline tracking, never auto-asserted | Yes |
| `vendors1099.ts` | Contractor tracking, W-9/TIN-last-4 only | Yes |
| `form1099k.ts` | Processor-reported gross vs. book gross reconciliation | Yes |
| `dataQualityFlags.ts` | Detectable mismatches surfaced for review, never auto-corrected | Yes |
| `monthlyClose.ts` | Non-destructive close checklist, always reopenable | Yes |
| `export.ts` | Assembles all of the above into one XLSX/CSV package | No (composes everything else) |

No file above duplicates another's money calculation — `profitLoss.ts` and `export.ts` are pure composition layers over the others, by design (spec requirement: "avoid duplicating money calculations across multiple components").

## Money representation

Every model in this codebase uses `Float`, not integer cents or `Decimal` — this predates the Finance Center sprint (Order/Invoice/Payment/FinanceExpense all already use `Float`) and every new model follows the same convention for consistency, rather than introducing a second money representation that would need conversion at every boundary. `round2()` (`lib/invoices.ts`) is the established rounding helper, reused wherever a report needs display-safe rounding.

## Admin surface

`/admin/finance` — one page, tabs (not separate routes), following the existing, deliberate 2026-08-12 IA decision documented in `components/admin/FinanceView.tsx`'s own header comment: "Finance is one section with several report *types*, not several nav destinations." Eleven tabs as of 2026-08-18: Dashboard, P&L/Sales Tax, Expense Ledger, Discounts & Credits, Inventory/COGS, Refunds, Vendors, Reconciliation, Owner Transactions, Tax Center, Vendor 1099s.

## P1 roadmap status (audited 2026-08-18)

**Implemented this pass** — safely completable without external credentials, paid subscriptions, or irreversible actions:
- **QuickBooks/Xero-ready export** (`lib/finance/export.ts`'s `buildQuickBooksXeroExpenseSheet`, Admin → Finance → "Export QuickBooks/Xero") — a bank-import-ready CSV, no paid connection or credential required.
- **Estimated Tax Planning** (`lib/finance/estimatedTax.ts`, Admin → Finance → Tax Center) — quarterly Book Profit × an owner-entered flat rate, explicitly labeled "Estimate only — not tax advice or a filing," never a computed rate or an asserted filing obligation.

**BLOCKED — OWNER/EXTERNAL DEPENDENCY** — cannot be safely built without one of: real bank credentials, a paid external subscription, a government filing, a tax/legal determination, or a payroll account:
| Item | What's actually needed |
|---|---|
| Live bank feeds | A bank-linking provider (e.g. Plaid) account + real bank credentials the owner would need to authorize directly with their bank — this environment has no bank access and must not attempt to acquire any. |
| Real automatic bank reconciliation | Depends on live bank feeds above — same blocker. |
| QuickBooks/Xero **paid API connection** (live two-way sync, distinct from the CSV export already built) | A QuickBooks Online or Xero paid subscription, an OAuth app registration, and the owner's own account credentials for that platform. |
| Automatic tax filing | A real government filing is a legal act only the owner (or their CPA, with the owner's authorization) can take — this system must never file anything. |
| 1099 e-filing | Same category as tax filing — a real submission to the IRS/a state, requiring the owner's own filer credentials and legal authorization. |
| Payroll (incl. S-corp payroll) | A licensed payroll provider account, EIN-linked tax deposits, and ongoing compliance obligations — a new, owner-initiated system, not an extension of bookkeeping. |

**Deferred, not blocked** — safely buildable later, scoped out of this pass by explicit engineering judgment rather than an external dependency:
- OCR receipt scanning, AI expense categorization (the `lib/ai/` provider/policy infrastructure this project already built could support this, but it's a real, separate scope of work — request/response schema, prompt design, a review-before-apply UX so a wrong AI category is never silently written — not a same-pass addition to an already-large sprint).
- Advanced forecasting (a distinct feature needing its own design pass on what "forecast" honestly means without inventing numbers).
- Receipt/document metadata beyond the existing `receiptUrl`/`receiptFilename` fields — blocked on the same real-file-storage-provider decision already tracked in `docs/PendingOwnerActions.md` #21, not attempted here since it's the same owner decision, not new scope.

None of the deferred items block using the Finance Center today; the export/report boundary is deliberately clean composition layers, so any of them can be added later without rebuilding the model above.
