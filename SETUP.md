# Pepscore — Developer Setup Guide

## Stack Overview
| Layer | Technology |
|---|---|
| Frontend / Hosting | Next.js 15 App Router + Vercel |
| Database | Neon Postgres (serverless) |
| ORM | Prisma |
| Auth | Clerk |
| Payments | Stripe Checkout + Webhooks |
| Shipping | Shippo API |
| Email | Resend |
| Cart State | Zustand (client-side, persisted) |
| Exports | xlsx (XLSX) + CSV |

---

## 1 — Clone & Install

```bash
git clone https://github.com/compscigrad/Pepscore-.git pepscore
cd pepscore
npm install
```

---

## 2 — Environment Variables

Copy the example file and fill in each key:

```bash
cp .env.local.example .env.local
```

### Required Keys

| Variable | Where to Get It |
|---|---|
| `DATABASE_URL` | Neon Dashboard → Connection String (pooled) |
| `DIRECT_URL` | Neon Dashboard → Connection String (direct) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `ADMIN_CLERK_USER_ID` | Clerk Dashboard → Users → your user → User ID |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Add endpoint |
| `SHIPPO_API_KEY` | Shippo Dashboard → API → Token |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Your verified sending domain (e.g. `orders@pepscore.com`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (local) or `https://pepscore.vercel.app` (prod) |

### Ship-From Address (used for Shippo label creation)
```
SHIP_FROM_NAME=Pepscore Research
SHIP_FROM_STREET=123 Lab Way
SHIP_FROM_CITY=Miami
SHIP_FROM_STATE=FL
SHIP_FROM_ZIP=33101
SHIP_FROM_COUNTRY=US
SHIP_FROM_PHONE=+13055550000
```

---

## 3 — Database Setup

```bash
# Push schema to Neon (creates all tables)
npm run db:push

# Seed the product catalog (9 Pepscore products)
npm run db:seed

# Optional: open Prisma Studio to inspect data
npm run db:studio
```

---

## 4 — Run Locally

```bash
npm run dev
```

Site: http://localhost:3000  
Admin: http://localhost:3000/admin (requires ADMIN_CLERK_USER_ID match)

---

## 5 — Stripe Webhook (Local Testing)

Install the Stripe CLI, then forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET`.

Test a checkout with card: `4242 4242 4242 4242` (any future date, any CVC).

---

## 6 — Deploy to Vercel

```bash
# Link to Vercel (first time only)
vercel link

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

Set all environment variables in the Vercel dashboard under Project → Settings → Environment Variables.

**Stripe Webhook in Production:**
1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `payment_intent.payment_failed`
4. Copy signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel env vars

---

## 7 — Admin Dashboard

The admin dashboard at `/admin` is only accessible to the Clerk user whose ID matches `ADMIN_CLERK_USER_ID`.

**Features:**
- YTD revenue, gross profit, net profit, pending shipments
- All orders table with profit breakdown per order
- Create Shippo shipping labels directly from the dashboard
- Download labels and view tracking numbers
- Annual CPA export (XLSX or CSV) covering all revenue, COGS, shipping costs, Stripe fees, net profit

---

## 8 — Key Architecture Decisions

- **Cart is client-side** (Zustand + localStorage) — no DB round-trip until checkout
- **Prices are validated server-side** at checkout — client prices are never trusted
- **RUO acknowledgment** is stored in `ComplianceAcknowledgment` table with IP and user agent
- **Stripe session metadata** carries `orderId` so the webhook can reliably find the order
- **Stripe fee** is estimated at 2.9% + $0.30 and logged as an `Expense` record
- **Static product fallback** on the home page means the storefront works even without a DB connection

---

## 9 — File Structure

```
app/
  page.tsx                  ← Home storefront
  layout.tsx                ← Root layout (Clerk + Toaster)
  checkout/
    page.tsx                ← Shipping form + RUO modal
    success/page.tsx        ← Post-payment confirmation
  account/page.tsx          ← Customer order history
  admin/page.tsx            ← Owner dashboard
  sign-in / sign-up/        ← Clerk auth pages
  api/
    checkout/route.ts       ← Creates Stripe session
    webhooks/stripe/        ← Stripe webhook handler
    shipping/labels/        ← Shippo label creation
    admin/orders/           ← Order management API
    admin/invoices/         ← Invoice management API
    export/                 ← CPA export (XLSX/CSV)

components/
  storefront/               ← Header, Footer, Cart, ProductCard, RuoModal
  admin/                    ← OrdersTable, ExportPanel

lib/
  prisma.ts / stripe.ts / resend.ts / shippo.ts
  cart-store.ts             ← Zustand cart
  orders.ts                 ← Number generators, formatCurrency
  export.ts                 ← XLSX/CSV builders

prisma/
  schema.prisma             ← Full DB schema
  seed.ts                   ← Product catalog seed

emails/
  OrderConfirmation.tsx     ← Order confirmation HTML email
  TrackingUpdate.tsx        ← Shipment tracking email
```

---

## 10 — RUO Compliance

Every order flow enforces:
1. "For Research Purposes Only" in the announcement bar and product cards
2. Full RUO disclaimer in the footer
3. **Mandatory checkbox acknowledgment** before Stripe Checkout (cannot be skipped)
4. RUO text is stored in `ComplianceAcknowledgment` table with timestamp, IP, and user agent
5. RUO disclaimer included in every order confirmation email and invoice
