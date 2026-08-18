# Pepscore Finance Data Dictionary

## New models (2026-08-18 Finance Center sprint)

### `OwnerTransaction`
Money the owner puts into or takes out of the business. `type`: `CONTRIBUTION` | `DISTRIBUTION` | `REIMBURSEMENT` | `OWNER_PAID_EXPENSE`. Never counted as sales revenue, a customer refund, or a business expense in any report — `lib/finance/ownerTransactions.ts`'s `getOwnerTransactionSummary()` sums by type independently.

### `BusinessTaxProfile`
Singleton (`id: "singleton"`, same pattern as the existing `InvoiceSettings`). Entity/tax identity metadata only — `legalBusinessName`, `dba`, `ein`, `stateOfFormation`, `businessAddress`, `taxYearType`, `entityType`, `federalTaxClassification`, `accountingMethod`, `stateLocalTaxRegistrations`, `salesTaxRegistrations`. Every field nullable/`UNKNOWN`-capable; nothing here is required to use any other part of the Finance Center.

### `TaxReminder`
`reminderType` (8 values: federal/DC estimated tax, annual federal/DC filing, sales tax filing, contractor 1099 reporting, business registration renewal, other) × `status` (`NOT_CONFIGURED` default, `UPCOMING`, `COMPLETED`, `OVERDUE` — always admin-set, never auto-derived from `dueDate`).

### `Vendor1099`
`vendorName`, `payeeType` (`UNKNOWN`/`BUSINESS`/`INDIVIDUAL`), `w9Received`, `tinLast4` (exactly 4 digits, enforced in `lib/finance/vendors1099.ts`'s `assertSafeTinLast4` — **never a full TIN/SSN**, matching `Payment.bankAccountLast4`'s existing safe-display precedent), `reviewStatus`. Year-to-date payment totals are **not stored on this model** — computed live from `FinanceExpense.vendor` at report time, so the dollar figure can never drift from the actual expense ledger.

### `Form1099KReconciliation`
One row per tax year (`taxYear` unique). Only `processorReportedGross` is stored (manually entered, no automated import exists) — everything else in the reconciliation report (`bookGross`, `refunds`, `fees`, `shipping`, `tax`, `adjustments`, `difference`) is computed live, never cached, so it can't go stale relative to the underlying invoices.

### `MonthlyClose`
`(year, month)` unique. Eight boolean checklist fields, `closedAt`/`closedBy`, `reopenedAt`/`reopenedBy`. Purely a tracking workflow — nothing else in the codebase checks whether a month is closed before allowing an edit.

## Modified existing models

### `Invoice.tax` (new field, `Float @default(0)`)
Sales tax charged on this invoice. Not written by any code path yet (no invoice-creation UI collects tax) — reports read it as-is, so it's honestly `$0` today, not fabricated.

### `Invoice.isTestData` / `Order.isTestData` (new fields, `Boolean @default(false)`)
**The one field every financial report must filter on to be correct.** See the [Financial Architecture](./PEPSCORE-FINANCIAL-ARCHITECTURE.md) doc for the bug this fixed and the exact backfilled invoice list. Every query below now includes `isTestData: false` (or joins through an `invoice: { isTestData: false }` relation filter):

- `lib/finance/reports.ts`: `getFinanceDashboardMetrics`, `getDiscountsCreditsReport`, `getRefundReport`
- `lib/invoices.ts`: `getInvoiceDashboardStats` (the admin Overview page's own revenue figure — was NOT already covered by the existing `archivedAt`/`deletedAt` filters, since a test invoice is not "probably a mistake," it was never a real transaction)
- `lib/finance/salesTax.ts`, `lib/finance/monthlySummary.ts`, `lib/finance/stripeReconciliation.ts`, `lib/finance/dataQualityFlags.ts` — all new this sprint, all filter from the start

**If you add a new revenue-touching query anywhere in this codebase, it must include this filter or it will silently include test data again.**

## Report-definition reference

| Term (as shown in the UI) | Exact definition |
|---|---|
| Gross Revenue | Sum of `Invoice.subtotal` for `ISSUED`/`REFUNDED`, non-test invoices in range |
| Discounts & Credits | Sum of `Invoice.discountTotal` (same scope) |
| Net Revenue | Sum of `Invoice.total` (same scope) |
| COGS | Sum of `InvoiceItem.costOfGoods × quantity` for known-cost line items only (never estimated for unknown ones) |
| COGS Coverage | `itemsWithCost / itemsTotal` — visibility into how much of COGS is actually known |
| Refunds | Sum of `InvoiceRefund.completedAmount` where `status = COMPLETED`, non-test invoice |
| Estimated Gross Margin | `Net Revenue − COGS − Shipping Expense − Payment Processing Fees` |
| Sales Tax Collected | Sum of `Invoice.tax` + `Order.tax` in range (currently always $0 — see the Tax Reporting Guide) |
| Stripe Reconciliation Status | `MATCHED` / `PARTIAL` / `MISMATCH` / `PENDING` / `NOT_AVAILABLE` — pure function `deriveReconciliationStatus()` in `lib/finance/stripeReconciliation.ts`, unit-tested, tolerates $0.01 of float rounding before flagging a real mismatch |
| Book Profit / Estimated Operating Profit | `Gross Profit − Operating Expenses` — explicitly never called "taxable income" anywhere in the UI |

## Owner-entered data (never inferred by this system)

`BusinessTaxProfile` (all fields), `TaxReminder` (creation + status), `Vendor1099` (creation, W-9/TIN status), `Form1099KReconciliation.processorReportedGross`, `OwnerTransaction` (every field), `MonthlyClose` checklist state.

## P1 roadmap

See [Financial Architecture](./PEPSCORE-FINANCIAL-ARCHITECTURE.md#what-was-explicitly-not-built-p1-per-spec-38).
