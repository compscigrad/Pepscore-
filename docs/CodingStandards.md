# Coding Standards

These apply to the invoice module and should guide any future module built the same way.

## TypeScript

- No `any`. If a Prisma-generated type doesn't quite fit a component's props, derive a narrower type from it (`Prisma.InvoiceGetPayload<...>`) rather than widening to `any` or duplicating the shape by hand.
- Prefer explicit interfaces for component props and function signatures, even where TypeScript could infer them — it's the fastest way for another engineer to understand a file without reading its implementation.
- Enums live in `prisma/schema.prisma` as the single source of truth; import the generated types (`InvoiceStatus`, `PaymentMethod`, etc.) from `@prisma/client` rather than redeclaring them in TypeScript.

## Components

- One responsibility per component. If a component both fetches data and renders a form, split it into a server component (fetch) and a client component (form).
- Controlled, not stateful: section components (`CustomerInfoSection`, `ShippingSection`, etc.) receive `value` + `onChange` and hold no state of their own — `InvoiceBuilder` is the single source of truth. This is what makes the live preview trivial: it's just another consumer of the same state.
- Client components only where interactivity requires it (`'use client'`) — pages that just fetch and pass props stay server components.

## Business Logic

- Money math lives in `lib/invoice/calculations.ts` and nowhere else. If you find a `subtotal + shipping - discount` computation inline in a component or API route, that's a bug waiting to happen — move it.
- Validation lives in `lib/invoice/validation.ts` (zod schemas). Client-side, the same schemas can run for early feedback, but the server-side check in the API route is the one that's authoritative.

## Comments

Explain *why*, not *what*. Example from `lib/invoice/calculations.ts`:

```ts
// Percentage discounts are computed against the pre-shipping items total
// (not the shipping-inclusive subtotal), so a "10% off" promo never
// discounts the customer's shipping cost.
```

Not:

```ts
// Loop through discounts and add them up
```

## Naming

- Prisma model names are singular (`Invoice`, `InvoiceItem`); API route folders and files follow Next.js App Router conventions (`route.ts`, `[id]/route.ts`).
- Boolean props/flags read as questions or states: `includeArchived`, `activeOnly` — not `archived` (ambiguous: does `true` mean "is archived" or "include archived"?).

## Error Handling

- API routes catch and return `{ error: string }` with an appropriate status code — never let an unhandled exception surface a raw stack trace to the client.
- Validation errors (zod) are caught and mapped to field-level messages the UI can show inline, per the spec's "friendly error messages" requirement.

## Dependencies

- Before adding a new dependency, check whether an existing one already covers the need (see `lib/orders.ts formatCurrency`, `react-hot-toast`, `lucide-react`). Two new dependencies were added for this module (`zod`, `@react-pdf/renderer`) — both because no existing dependency did what was needed; see [Decisions.md](./Decisions.md).

## Testing

No test suite exists yet in this project. New code should stay test-friendly regardless: `lib/invoice/calculations.ts` and `lib/invoice/validation.ts` are pure functions with no framework dependency specifically so a future test suite (Vitest/Jest) can cover them without mocking Next.js or Prisma.
