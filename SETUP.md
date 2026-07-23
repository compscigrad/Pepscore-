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
| `SHIPPO_WEBHOOK_SECRET` | Generate any random string yourself — see "Invoice Shipment Tracking" below for how it's used |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | The one sender identity for all transactional email (e.g. `Pepscore Orders <orders@pepscorelab.com>`) — until pepscorelab.com is verified in Resend, leave unset; falls back to Resend's own sandbox address |
| `RESEND_REPLY_TO_EMAIL` | Default Reply-To when a send site doesn't pick a more specific mailbox below. Defaults to `SUPPORT_EMAIL` if unset |
| `ADMIN_EMAIL` / `BILLING_EMAIL` / `CONTACT_EMAIL` / `ORDERS_EMAIL` / `SUPPORT_EMAIL` | The five real pepscorelab.com mailboxes — see `lib/resend.ts` for which email type uses which as Reply-To. None require Resend domain verification (display text / Reply-To only, never the SMTP sender) — safe to set now |
| `CRON_SECRET` | Generate any random string; must also be set in Vercel's Project Settings → Environment Variables (Production + Preview) — authenticates the daily invoice auto-archive sweep at `/api/cron/archive-invoices` and the shipment-tracking polling fallback at `/api/cron/poll-tracking` (see `vercel.json`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (local) or `https://pepscore-compscigrads-projects.vercel.app` (prod) — must match a domain/alias that actually has a live deployment; `pepscore.vercel.app` does not and was found broken in production (see docs/ChangeLog.md) |

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

---

## 11 — Invoice Shipment Tracking (carrier-agnostic, via Shippo)

See `docs/Decisions.md` #22 for the full design; this section is just the operational setup.

**Webhook endpoint:** `POST /api/webhooks/shippo`

Register it with Shippo including the shared-secret token (Shippo doesn't sign webhook payloads the way Stripe does, so this token in the URL itself *is* the auth boundary):

1. Shippo Dashboard → Settings → API → Webhooks → Add Webhook
2. Event: `track_updated`
3. URL: `https://your-domain.vercel.app/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_SECRET>` (use the exact value you set for `SHIPPO_WEBHOOK_SECRET`)

**Local webhook testing:** Shippo doesn't have a CLI forwarder like `stripe listen`. Use a tunnel (e.g. `ngrok http 3000`) and register the tunnel's HTTPS URL (with the `?token=...` query param) as a temporary webhook in the Shippo dashboard, or simulate a webhook directly:

```bash
curl -X POST "http://localhost:3000/api/webhooks/shippo?token=$SHIPPO_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"data":{"tracking_number":"<a tracking number you registered>","carrier":"usps","tracking_status":{"status":"TRANSIT","status_details":"In transit","status_date":"2026-01-01T12:00:00Z"},"tracking_history":[{"object_id":"evt_1","status":"TRANSIT","status_details":"In transit","status_date":"2026-01-01T12:00:00Z"}]}}'
```

**Polling fallback:** `GET /api/cron/poll-tracking`, scheduled in `vercel.json` (`CRON_SECRET`-gated, same pattern as the invoice auto-archive sweep). Rechecks any shipment with `monitoringActive: true` that hasn't been checked in the last 4 hours, up to 50 per run, with 2 retries (1s/3s backoff) per shipment before logging a failure and moving on — one failing shipment never blocks the rest of the batch. **Note:** Vercel's Hobby plan only runs cron jobs on a daily schedule; the configured `0 */4 * * *` cadence needs a Pro-plan project to actually fire every 4 hours.

**Sandbox testing limitation:** a test/sandbox `SHIPPO_API_KEY` only accepts Shippo's fake `'shippo'` test carrier for `registerTracking` — a real `USPS`/`UPS`/`FEDEX`/`DHL` token gets rejected with `"<carrier> is not a valid test tracking carrier"`. This is expected in sandbox mode, not a bug; it resolves itself once a live Shippo API key is in use.

**Adding a new carrier:**
- If Shippo already supports it: add the carrier to the `ShippingCarrier` enum in `prisma/schema.prisma`, add it to `TRACKABLE_CARRIERS` in `lib/tracking/types.ts`, map it to Shippo's carrier token in `SHIPPO_CARRIER_TOKEN` (`lib/tracking/shippoProvider.ts`), and add a tracking-URL case in `lib/tracking/carrierUrls.ts`. No changes needed anywhere else.
- If it needs its own direct API instead of Shippo: implement `ShippingProvider` (`lib/tracking/types.ts`) in a new adapter file, then route that carrier to it in `getProviderForCarrier()` (`lib/tracking/registry.ts`).

**Notification settings:** `Settings → Invoices` — per-`ShippingStatus` on/off toggles stored in `InvoiceSettings.trackingNotificationsEnabled` (a status missing from the map defaults to enabled). Notifiable statuses: Tracking Added, Accepted by Carrier, In Transit, Delayed, Delivery Exception, Out for Delivery, Delivered, Returned to Sender.

**Running the unit tests:** `npm test` (vitest) — covers tracking-number format validation, event-hash dedup, Shippo status normalization, the order-status completion rule, carrier URL building, and text sanitization.
