# Pepscore Tax Reporting Guide

**This is bookkeeping organization, not tax preparation.** Every figure in the Finance Center is a real number computed from Pepscore's own records — never a filed return, never a legal conclusion, never tax advice. A CPA/accountant should review this material before it's used for an actual filing.

## Unresolved tax assumptions (owner/CPA decision required)

These are genuinely open — nothing in this system decides them, and nothing should be inferred from a default value:

1. **Entity type / federal tax classification** — `BusinessTaxProfile.entityType` defaults to `UNKNOWN`. Set it in Admin → Finance → Tax Center → Business Profile once known. Nothing elsewhere in the app assumes a specific entity type.
2. **Accounting method (cash vs. accrual)** — defaults to `UNKNOWN`. The revenue-recognition rule the reports actually use today (`RECOGNIZED_REVENUE_STATUSES = ['ISSUED', 'REFUNDED']` in `lib/finance/reports.ts`) recognizes revenue when an invoice is issued, not when cash is received — closer to accrual in practice, but this was a 2026-08-12 judgment call, not a confirmed accounting-method election. Confirm with a CPA before relying on it for a specific method's filing.
3. **Sales tax obligation** — no tax is collected anywhere today (`$0` is the honest, current figure). See `docs/launch/SalesTaxDecision.md` for the full analysis; the Sales Tax Ledger here just reports whatever the real fields say, whenever that changes.
4. **Governing-law jurisdiction / state of formation** — not asserted anywhere in this codebase; set once known.
5. **1099 filing obligations for vendors** — the Vendor 1099 tracker (Admin → Finance → Vendor 1099s) records W-9/TIN-last-4/payment totals for visibility; it does not determine who legally requires a 1099 or file one.
6. **Federal/DC estimated tax, filing deadlines** — Tax Reminders (Admin → Finance → Tax Center) default to `NOT_CONFIGURED` and are never auto-derived from a date. Add one manually if/when a real deadline is known; the software will never tell you a filing is legally required just because a date has passed.

## How to read the P&L

Available at Admin → Finance → P&L / Sales Tax. Structure:

```
Product Sales
+ Shipping Revenue        (always $0 today — see docs/launch/CheckoutShippingOptions.md)
+ Other Revenue           (always $0 — no other-revenue source exists yet)
- Discounts
- Refunds
= Net Revenue

- COGS (product cost only; packaging allocation always $0 — out of scope this sprint)
= Gross Profit

- Operating Expenses (shipping cost, payment processing fees, other)
= Operating Profit  ("Estimated Book Profit" elsewhere in the UI)
```

Sales tax collected is shown as its own line, **never added into Revenue** — it was never the business's money.

Every occurrence of this figure in the UI is labeled **Book Profit** or **Estimated Operating Profit**, never "taxable income" or "net profit" — final taxable income is determined during actual tax preparation, which can differ from book profit for many legitimate reasons (depreciation, different expense timing, elections, etc.).

## 1099-K reconciliation (Admin → Finance → Tax Center)

Card-processor 1099-K forms report **gross receipts before** refunds, fees, discounts, and shipping are subtracted — so a 1099-K figure will almost never equal Pepscore's own net revenue, and that's expected, not an error. Enter the processor's actual reported figure once the form arrives at year-end (no automated import exists); the report shows the real difference and its components so a CPA can explain the gap in three minutes instead of guessing.

## Monthly close (Admin → Finance → Reconciliation)

A checklist, not a lock — nothing in the app is prevented from being edited after a month shows "Closed." It exists purely so nothing gets forgotten (orders reconciled, payments reconciled, refunds reconciled, shipping reconciled, expenses entered, receipts reviewed, sales tax reviewed, bank reconciled). Reopening is always available.

## Annual export package (Admin → Finance, "Export Excel")

One workbook per date range, deterministic filename (`Pepscore_<year>_<range>_Export_<export-date>.xlsx`). Sheets: Summary, Expense Ledger, Shipping, Discounts & Credits, Inventory/COGS, Refunds, Vendors, Needs Review, Sales Tax, Owner Transactions, Stripe Reconciliation, 1099-K Reconciliation, Unreconciled Items, QuickBooks-Xero Import. Hand this to a CPA as-is — every number in it traces back to a real Pepscore record, never a synthesized or estimated one.

## QuickBooks / Xero import (Admin → Finance, "Export QuickBooks/Xero")

A standalone CSV (Date, Description, Payee, Amount, Category, Memo — amounts negative, matching both platforms' own "money out" bank-import convention) that uploads directly through QuickBooks Online's or Xero's own **existing bank-statement import feature** — neither requires a fixed column schema for this; both let you map columns to your chart of accounts during the upload. This does **not** require a paid QuickBooks/Xero subscription, an API connection, or any credential — it is a file the owner downloads and uploads by hand. A live, real-time two-way accounting sync (the QuickBooks/Xero API, OAuth-connected) is a materially different, subscription-gated capability that has not been built and is not planned without explicit owner approval of the paid connection.

## What this system will never do without explicit, separate owner action

File a return (1040, Schedule C, Schedule SE, 1120-S, K-1, D-30, or any other), submit sales tax, pay estimated tax, register for a tax account, issue or e-file a 1099, move money, or connect a bank account. If a future professionally-validated filing module is ever built, it will be a deliberate, separate decision — not an extension of this reporting layer.
