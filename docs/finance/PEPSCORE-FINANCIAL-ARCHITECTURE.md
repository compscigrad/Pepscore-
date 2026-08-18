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

## What was explicitly not built (P1, per spec #38)

Live bank feeds, automatic bank reconciliation, OCR receipt scanning, AI expense categorization, QuickBooks/Xero integration, automated tax filing, automatic 1099 e-filing, advanced forecasting, automatic estimated-tax calculation, payroll. None of these block using the Finance Center today; all are architecturally possible to add later without rebuilding the model above (export/report boundaries are already clean composition layers).
