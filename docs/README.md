# Pepscore Docs

This `/docs` folder is the permanent source of truth for the Pepscore codebase, and specifically for the **Invoice Management System**. Before starting any new invoice-related work, read [`InvoiceSystemSpec.md`](./InvoiceSystemSpec.md) and [`Architecture.md`](./Architecture.md) first. After finishing work, update the relevant doc in the same PR — these files should never drift from what the code actually does.

## Contents

| File | What it covers |
|---|---|
| [ProjectOverview.md](./ProjectOverview.md) | Why Pepscore exists, current and future modules |
| [Architecture.md](./Architecture.md) | How data flows through the app, layer responsibilities |
| [InvoiceSystemSpec.md](./InvoiceSystemSpec.md) | The frozen engineering spec (Parts 1 & 2, verbatim) |
| [ComponentMap.md](./ComponentMap.md) | Every invoice component — purpose, props, dependencies |
| [FolderStructure.md](./FolderStructure.md) | What lives where, and why |
| [UIUXGuidelines.md](./UIUXGuidelines.md) | The Pepscore design language, with real token values |
| [CodingStandards.md](./CodingStandards.md) | TypeScript/React conventions used across the codebase |
| [FutureRoadmap.md](./FutureRoadmap.md) | Modules planned but not yet built |
| [ChangeLog.md](./ChangeLog.md) | Notable changes to the invoice system over time |
| [Decisions.md](./Decisions.md) | Why the invoice system was built the way it was |
| [TODO.md](./TODO.md) | Known gaps and follow-up work, by priority |

## Project Overview

Pepscore is a peptide research supplier. The main app (`master` branch) is a Next.js 16 App Router storefront with Stripe checkout, Clerk auth, and an admin dashboard. The invoice system extends that admin dashboard with a standalone invoicing tool for manual/off-platform sales (cash, Cash App, Zelle, etc.) that never touch Stripe checkout, in addition to invoices tied to real storefront orders.

## Technologies Used (invoice module additions)

- **`@react-pdf/renderer`** — generates the Master Invoice and Recipient Receipt PDFs from React component trees (no headless-browser dependency)
- **`zod`** — server-side validation of invoice/payment payloads

Everything else (Next.js, Prisma/Neon, Clerk, Tailwind) is the existing project stack — see the root [`SETUP.md`](../SETUP.md) for full environment setup.

## Installation & Local Development

```bash
cd pepscore
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL / DIRECT_URL at minimum
npm run db:push                    # sync schema, including invoice tables
npm run db:seed                    # product catalog
npm run db:seed:invoices           # optional: sample "Marvin Alexander" invoice + promotions
npm run dev
```

Invoice dashboard: `http://localhost:3000/admin/invoices` (requires `ADMIN_CLERK_USER_ID` to match your signed-in Clerk user — see root `SETUP.md`).

## Build

```bash
npm run build   # runs `prisma generate` then `next build`
```

## How Invoice Generation Works

1. An admin creates or edits an invoice at `/admin/invoices/new` or `/admin/invoices/[id]`. The `InvoiceBuilder` component holds all form state and renders a live `InvoicePreview` alongside it — pure React state, no reload.
2. On save, the payload is validated server-side (`lib/invoice/validation.ts`) and persisted through `lib/invoices.ts`, the single service module that owns all invoice Prisma queries.
3. All money math (line totals, discounts, balance) runs through `lib/invoice/calculations.ts` — the same functions the live preview, the save endpoint, and the PDF documents all call, so the three can never disagree.

## PDF Generation

`GET /api/admin/invoices/[id]/pdf?variant=master|recipient` streams a PDF built with `@react-pdf/renderer` from `lib/invoice/pdf/MasterInvoiceDocument.tsx` / `RecipientReceiptDocument.tsx`. PDFs are generated on request, not stored as files — see [Decisions.md](./Decisions.md) for why.

## Future Expansion

See [FutureRoadmap.md](./FutureRoadmap.md).

## Troubleshooting

- **"Environment variable not found: DIRECT_URL"** when running `prisma` commands directly — the Prisma CLI only auto-loads `.env`, not `.env.local`. Either copy your values into a `.env` file or export them into your shell before running `npx prisma ...` (Next.js itself loads `.env.local` fine for `npm run dev`).
- **Invoice numbers not sequential / gaps** — numbering counts invoices created within the current calendar year; archived invoices still count (numbers are never reused, per spec).
- **PDF looks different from the live preview** — expected to a degree: the preview is real DOM/Tailwind, the PDF uses `@react-pdf/renderer`'s own layout primitives. Both pull from the same `lib/invoice/pdf/brand.ts` constants, but pixel-parity isn't guaranteed. See [Decisions.md](./Decisions.md).

## Common Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run db:push` | Sync Prisma schema to the database |
| `npm run db:seed` | Seed product catalog |
| `npm run db:seed:invoices` | Seed sample invoice + promotions |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check without emitting |

## Contribution Guidelines

- Business logic (calculations, validation, numbering, PDF generation) lives in `lib/invoice/`, never inside a component.
- All invoice persistence goes through `lib/invoices.ts` — don't call `prisma.invoice.*` from an API route or page directly.
- New enum values are additive; don't rename or remove existing enum members without checking every call site (`git grep` the enum name first).
- Update the relevant `/docs` file in the same PR as the code change.
