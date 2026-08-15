// POST /api/checkout
// Creates a Stripe Checkout Session from the cart, pre-creates a PENDING order,
// stores the RUO acknowledgment, and returns the Stripe session URL.

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber, generateInvoiceNumber } from '@/lib/orders'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isStorefrontCheckoutEnabled, STOREFRONT_CHECKOUT_DISABLED_MESSAGE } from '@/lib/storefront/checkoutGate'
import { getStorefrontAvailability, isPurchasable } from '@/lib/storefront/availability'
import { resolveCheckoutLine, computeVialsToReserve } from '@/lib/storefront/checkoutPricing'
import { SELL_UNIT_DISPLAY_LABEL } from '@/lib/pricing/sellUnits'
import { reserveForOrderItemTx, releaseAllOrderReservationsTx } from '@/lib/inventory/orderReservations'
import { getPaymentSettings } from '@/lib/payments/settings'
import { resolveCustomerIdForCheckout, resolvePromotionCode, PROMOTION_CODE_INVALID_MESSAGE } from '@/lib/promotions/redemption'
import { getInvoiceLinePriceTier } from '@/lib/pricing/lineOverride'
import { applyBackorder } from '@/lib/backorders'
import { recordRuoAcceptance } from '@/lib/compliance/ruo'
import { upsertUserByClerkId } from '@/lib/user'
import type { CheckoutLineItem, ShippingAddress } from '@/types'
import type Stripe from 'stripe'

// See the reservation-hoarding guard below for why this exists.
const MAX_CONCURRENT_PENDING_ORDERS_PER_EMAIL = 3

export async function POST(req: NextRequest) {
  try {
    // Authoritative server-side gate -- checked before any Stripe call, any
    // rate-limit bookkeeping, or any DB write, so a disabled storefront
    // never creates a PENDING Order/Invoice row for a checkout that can't
    // actually complete. The checkout page's own UI gate is a convenience;
    // this is the real boundary no client request can bypass.
    if (!isStorefrontCheckoutEnabled()) {
      return NextResponse.json({ error: STOREFRONT_CHECKOUT_DISABLED_MESSAGE }, { status: 503 })
    }

    const rateLimit = checkRateLimit(`checkout:${getClientIp(req)}`, 10, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts — please wait a moment and try again.' },
        { status: 429, headers: rateLimit.retryAfterSeconds ? { 'Retry-After': String(rateLimit.retryAfterSeconds) } : undefined }
      )
    }

    const { userId } = await auth()
    const body = await req.json()

    const {
      items,
      shippingAddress,
      customerEmail,
      customerName,
      ruoAgreed,
      promotionCode,
    }: {
      items: CheckoutLineItem[]
      shippingAddress: ShippingAddress
      customerEmail: string
      customerName: string
      ruoAgreed: boolean
      promotionCode?: string
    } = body

    if (!ruoAgreed) {
      return NextResponse.json({ error: 'RUO acknowledgment is required' }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Reservation-hoarding guard (Phase 4G): each checkout attempt reserves
    // real physical stock for up to 25h (release-abandoned-reservations
    // cron) before ever being paid for. Without a per-identity cap, a bad
    // actor could hold significant inventory hostage by starting many
    // checkouts and abandoning all of them -- the per-IP rate limit above
    // bounds velocity but not how many can stay open simultaneously, and IP
    // rotation defeats it entirely. A real customer essentially never has
    // several truly concurrent, still-open checkout attempts, so this adds
    // no friction to normal use.
    if (customerEmail) {
      const openPendingCount = await prisma.order.count({
        where: { customerEmail: { equals: customerEmail, mode: 'insensitive' }, status: 'PENDING' },
      })
      if (openPendingCount >= MAX_CONCURRENT_PENDING_ORDERS_PER_EMAIL) {
        return NextResponse.json(
          { error: 'You have several checkout attempts already in progress. Please complete or wait for one to expire, then try again.' },
          { status: 429 }
        )
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Resolve product records from DB to get authoritative prices
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Build validated line items using DB prices (never trust client-side
    // prices) -- authoritative per-sell-unit pricing (lib/storefront/
    // checkoutPricing.ts), not the legacy Product.price field and not
    // whatever the client cart happened to snapshot. A product with no
    // approved active price for the requested tier, or one that's out of
    // stock/coming soon (lib/storefront/availability.ts), can't be checked
    // out at all -- the same rules ProductCard's "Add to Cart" gating
    // already enforces client-side.
    const lineItems = items.map(i => {
      const product = productMap.get(i.productId)
      if (!product) throw new Error(`Product ${i.productId} not found`)
      // Archived (pricingStatus INACTIVE) products are already excluded
      // from every browse surface (homepage, category, search, product
      // detail -- see lib/storefront/pricing.ts's getStorefrontPrice()),
      // but nothing previously stopped a stale cart, a bookmarked page, or
      // a direct API call from checking one out by id. Checked here,
      // authoritatively, independent of stock -- an archived product can
      // still show AVAILABLE stock and pass isPurchasable() below.
      if (product.pricingStatus === 'INACTIVE') {
        throw new Error(`${product.name} (${product.size}) is no longer available for purchase`)
      }
      // Sell-unit-level fulfillment (2026-08-15) -- Standard Case and Single
      // Vial are independent physical-stock pools, so purchasability must be
      // checked against the sell unit actually being bought, not a single
      // case-level default. Without this, a Single Vial that's genuinely
      // Ready to Ship could be wrongly rejected while its Standard Case is
      // Out of Stock, or the reverse could wrongly let an unavailable single
      // vial through while the case is fine.
      if (!isPurchasable(getStorefrontAvailability(product, i.sellUnit === 'INDIVIDUAL_VIAL' ? 'INDIVIDUAL_VIAL' : 'CASE'))) {
        throw new Error(`${product.name} (${product.size}) is currently out of stock`)
      }
      const resolved = resolveCheckoutLine(product, i.sellUnit)
      return {
        ...i,
        sellUnit: resolved.sellUnit,
        unitsPerSellUnit: resolved.unitsPerSellUnit,
        unitPrice: resolved.unitPrice,
        total: resolved.unitPrice * i.quantity,
        costOfGoods: product.costOfGoods * i.quantity,
      }
    })

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0)
    const freeShipping = subtotal >= 150
    const shippingCost = freeShipping ? 0 : 0 // Shippo rates fetched post-checkout

    // Resolved once regardless of whether a promotion code was submitted --
    // an existing Customer/Lead match (by linked userId, else case-
    // insensitive email) is also how Invoice.customerId gets set below, so
    // this checkout's Invoice is actually reachable from /account/invoices
    // and /account/tracking (both customerId-scoped) rather than silently
    // orphaned. Never creates a new Customer row here -- that's a separate,
    // larger identity-resolution decision than this fix is scoped to; a
    // genuinely new guest email simply resolves to null, same as before.
    const resolvedCustomerId = await resolveCustomerIdForCheckout(userId ?? null, customerEmail)

    // Resolve and authoritatively re-validate a promotion code before
    // creating anything -- never trusts a client-calculated discount, and
    // never creates a PENDING Order for a checkout attempt with an invalid
    // code (fail fast). See lib/promotions/redemption.ts's header comment
    // for the two-phase soft-hold/finalize design that keeps an abandoned
    // checkout from permanently burning a one-time code.
    let appliedPromotionCodeId: string | null = null
    let discountAmount = 0
    if (promotionCode) {
      if (!resolvedCustomerId) {
        return NextResponse.json({ error: PROMOTION_CODE_INVALID_MESSAGE.WRONG_CUSTOMER }, { status: 400 })
      }
      const result = await resolvePromotionCode(promotionCode, {
        customerId: resolvedCustomerId,
        cartSubtotal: subtotal,
        cartProductSlugs: products.map((p) => p.slug),
      })
      if (!result.valid) {
        return NextResponse.json({ error: PROMOTION_CODE_INVALID_MESSAGE[result.reason] }, { status: 400 })
      }
      appliedPromotionCodeId = result.code.id
      discountAmount = result.discountAmount
    }

    const total = subtotal + shippingCost - discountAmount

    // Pre-create order record in PENDING state
    const orderNumber = generateOrderNumber()
    const invoiceNumber = generateInvoiceNumber()

    // Order creation and inventory reservation happen in one transaction:
    // a shortfall on any non-backordered item rolls the whole order back
    // rather than leaving a PENDING Order with nothing actually held. A
    // backordered item (product.backorderEnabled) is EXPECTED to reserve
    // nothing (physicalStockOnHand is already 0 by definition) -- that's
    // not a shortfall to block on, it's the whole point of backorder
    // support (lib/storefront/availability.ts already gated non-purchasable
    // items out above; this only re-checks the ones that passed that gate).
    const { order, backorderedInvoiceItemIds } = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? undefined,
          customerEmail,
          customerName,
          shippingAddress: JSON.parse(JSON.stringify(shippingAddress)),
          status: 'PENDING',
          subtotal,
          shippingCost,
          discountAmount,
          total,
          appliedPromotionCodeId,
          items: {
            create: lineItems.map(i => ({
              productId: i.productId,
              name: i.name,
              size: i.size,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              sellUnit: i.sellUnit,
              unitsPerSellUnit: i.unitsPerSellUnit,
              costOfGoods: (productMap.get(i.productId)?.costOfGoods ?? 0) * i.quantity,
              total: i.total,
            })),
          },
          invoice: {
            create: {
              invoiceNumber,
              status: 'DRAFT',
              customerId: resolvedCustomerId ?? undefined,
              customerName,
              customerEmail,
              shippingAddress: JSON.parse(JSON.stringify(shippingAddress)),
              subtotal,
              total,
              balanceDue: total,
              shippingCost,
              // Without these, the checkout-created Invoice was an empty
              // shell with no InvoiceItem rows at all -- unusable by any
              // invoice-based feature (backorder compensation, itemized
              // PDF/detail view, admin line editing) for a real storefront
              // sale. Mirrors the Order.items shape above from the same
              // already-validated lineItems, using InvoiceItemSellUnit
              // (the same enum OrderItem.sellUnit already reuses) and the
              // same vials-consumed computation the reservation call below
              // uses, so the two records agree on what was actually sold.
              items: {
                create: lineItems.map(i => ({
                  productId: i.productId,
                  name: i.name,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  total: i.total,
                  sellUnit: i.sellUnit,
                  unitsPerSellUnit: i.unitsPerSellUnit,
                  priceTier: getInvoiceLinePriceTier(i.sellUnit),
                  skuSnapshot: productMap.get(i.productId)?.sku ?? undefined,
                  inventoryQuantityConsumed: computeVialsToReserve(i.quantity, i.unitsPerSellUnit),
                })),
              },
            },
          },
        },
        include: { items: true, invoice: { include: { items: true } } },
      })

      // Collected here, applied via applyBackorder() *after* this
      // transaction commits (below) -- never inside it. A hiccup in
      // backorder/compensation bookkeeping must not roll back an otherwise-
      // valid Order a customer is actively trying to pay for; the Order and
      // its reservation shortfall are already the authoritative record of
      // what happened even if the BackorderCondition application below
      // fails for some reason (caught and logged there, not re-thrown).
      const backorderedInvoiceItemIds: string[] = []

      for (const orderItem of created.items) {
        const product = productMap.get(orderItem.productId)
        // Reserve physical vials, not raw cart "quantity" -- a quantity of
        // 2 Standard Cases (10 vials each) must reserve 20 vials, not 2.
        const { shortfall } = await reserveForOrderItemTx(tx, {
          productId: orderItem.productId,
          orderId: created.id,
          orderItemId: orderItem.id,
          quantity: computeVialsToReserve(orderItem.quantity, orderItem.unitsPerSellUnit),
          actor: 'storefront-checkout',
        })
        if (shortfall > 0 && !product?.backorderEnabled) {
          throw new Error(`${orderItem.name} (${orderItem.size}) no longer has enough stock available — please update your cart.`)
        }
        if (shortfall > 0 && product?.backorderEnabled) {
          // Matched by (productId, sellUnit), not array position -- both
          // Order.items and Invoice.items were created from the same
          // lineItems array in the same request, but a cart can never have
          // two lines sharing one (productId, sellUnit) pair (cart-store.ts's
          // sameLine() already dedupes on exactly that pair), so this is an
          // unambiguous match without depending on Prisma's nested-create
          // return ordering, which isn't a documented guarantee.
          const invoiceItem = created.invoice?.items.find(
            (ii) => ii.productId === orderItem.productId && ii.sellUnit === orderItem.sellUnit
          )
          if (invoiceItem) backorderedInvoiceItemIds.push(invoiceItem.id)
        }
      }

      return { order: created, backorderedInvoiceItemIds }
    })

    // Store RUO acknowledgment -- always recorded per-order (audit trail
    // tied to this specific purchase), whether the customer just clicked
    // through the modal (guest, or a signed-in customer's first
    // acceptance of the current version) or the client skipped showing it
    // because /api/compliance/ruo/status already confirmed a signed-in
    // customer accepted this version previously -- either way ruoAgreed
    // must be true (checked above) before a checkout session is ever
    // created.
    //
    // ComplianceAcknowledgment.userId is a foreign key to the internal
    // User.id, never the raw Clerk id -- resolve it first (2026-08-12 fix;
    // this call previously passed the Clerk id directly and threw an
    // unhandled foreign-key violation the first time any signed-in
    // customer checked out, see lib/compliance/ruo.ts). Uses Clerk's own
    // verified email (not the checkout form's customerEmail, which a
    // signed-in customer could type differently) to stay consistent with
    // every other User-row-creation call site in this codebase. Falls back
    // to an unattributed (guest-equivalent) acceptance record rather than
    // failing checkout if Clerk has no verified email on file yet -- a
    // missing account link is a lesser harm than blocking a paying order.
    let internalUserId: string | undefined
    if (userId) {
      const clerkUser = await currentUser()
      const primaryEmail = clerkUser?.primaryEmailAddress
      if (primaryEmail?.verification?.status === 'verified') {
        const user = await upsertUserByClerkId(userId, primaryEmail.emailAddress)
        internalUserId = user.id
      }
    }

    await recordRuoAcceptance({
      orderId: order.id,
      userId: internalUserId,
      ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
      source: 'checkout',
    })

    // Apply the real backorder record (+ automatic $25-over-$100 credit,
    // same policy/idempotency as every admin-applied backorder) for any
    // line the reservation loop above accepted with a shortfall because
    // backorderEnabled allowed it -- Phase 4N: previously this shortfall
    // was silently absorbed with zero record anywhere (not even an
    // inventory ledger entry), leaving no way for an admin to ever
    // discover a storefront order needed backorder follow-up. Applied
    // post-commit, one at a time, each independently caught -- a failure
    // here must never undo an Order/Stripe-session a customer is actively
    // paying for; the Order and its reservation shortfall already stand as
    // the authoritative record even if this bookkeeping step fails.
    if (order.invoice) {
      for (const invoiceItemId of backorderedInvoiceItemIds) {
        try {
          await applyBackorder({
            invoiceId: order.invoice.id,
            invoiceItemId,
            appliedBy: 'system-storefront-checkout',
            source: 'SYSTEM',
          })
        } catch (backorderErr) {
          console.error('[checkout] Failed to apply automatic backorder record:', backorderErr)
        }
      }
    }

    // Which methods actually show on Stripe's embedded Checkout --
    // admin-configurable (Settings > Payments), never hardcoded. Falls
    // back to card-only in the pathological case every toggle is somehow
    // off (updatePaymentSettings itself refuses to save that state, but a
    // checkout request should never 500 with an empty array regardless).
    // paypalEnabled only actually works once PayPal is turned on for this
    // Stripe account in the Stripe Dashboard (an owner action) -- if it
    // isn't, Stripe rejects session creation and the catch block below
    // handles it the same as any other Stripe API failure.
    const paymentSettings = await getPaymentSettings()
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
      ...(paymentSettings.cardEnabled ? (['card'] as const) : []),
      ...(paymentSettings.achEnabled ? (['us_bank_account'] as const) : []),
      ...(paymentSettings.cashAppEnabled ? (['cashapp'] as const) : []),
      ...(paymentSettings.paypalEnabled ? (['paypal'] as const) : []),
    ]
    if (paymentMethodTypes.length === 0) paymentMethodTypes.push('card')

    // Build Stripe line items -- includes the resolved sell-unit label
    // (e.g. "Individual Vial") so what the customer sees on Stripe's own
    // checkout page matches what they actually selected, not just the bare
    // product/strength name every tier used to share.
    const stripeLineItems = lineItems.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${i.name} (${i.size}) — ${SELL_UNIT_DISPLAY_LABEL[i.sellUnit]}`,
          description: 'For Research Use Only. Not for human use.',
        },
        unit_amount: Math.round(i.unitPrice * 100),
      },
      quantity: i.quantity,
    }))

    // A promotion discount is applied by proportionally scaling down every
    // line item's unit_amount rather than a Stripe-side Coupon object --
    // simpler than syncing our own PromotionCode model into Stripe's
    // separate coupon system, and it guarantees the amount Stripe actually
    // charges is byte-exact with Order.total, never a few cents off from
    // independent per-line rounding. The last line absorbs any rounding
    // remainder so the sum always lands exactly on the target.
    if (discountAmount > 0) {
      const targetTotalCents = Math.round((subtotal - discountAmount) * 100)
      const originalTotalCents = stripeLineItems.reduce((s, li) => s + li.price_data.unit_amount * li.quantity, 0)
      if (originalTotalCents > 0) {
        let allocatedCents = 0
        stripeLineItems.forEach((li, idx) => {
          const lineOriginalCents = li.price_data.unit_amount * li.quantity
          const isLast = idx === stripeLineItems.length - 1
          const lineTargetCents = isLast ? targetTotalCents - allocatedCents : Math.round((lineOriginalCents / originalTotalCents) * targetTotalCents)
          allocatedCents += lineTargetCents
          li.price_data.unit_amount = Math.max(0, Math.round(lineTargetCents / li.quantity))
        })
      }
    }

    // If this is an authenticated, portal-linked returning customer who
    // has ever saved a payment method, attach their real Stripe Customer
    // id to the session -- Stripe's own embedded Checkout then surfaces
    // their saved methods automatically, with zero custom "choose a saved
    // method" UI to build here. `customer` and `customer_email` are
    // mutually exclusive on Stripe's Checkout Session API, so this is an
    // either/or, never both. A guest or a linked customer who has never
    // saved a method (no stripeCustomerId yet) still checks out exactly
    // as before, on customer_email alone -- nothing here ever creates a
    // Stripe Customer during a purchase; that only happens the first time
    // someone explicitly adds a saved method in the portal.
    let existingStripeCustomerId: string | null = null
    if (userId) {
      const linkedCustomer = await prisma.customer.findUnique({ where: { userId }, select: { stripeCustomerId: true } })
      existingStripeCustomerId = linkedCustomer?.stripeCustomerId ?? null
    }

    // Create Stripe Checkout Session -- own try/catch so a Stripe-side
    // failure here (network error, API rejection) releases the inventory
    // this order's transaction above already committed, rather than
    // leaving stock held against an order that will never actually pay.
    try {
      // ui_mode: 'embedded' -- renders in-page via @stripe/react-stripe-js's
      // EmbeddedCheckout instead of redirecting to Stripe's hosted page
      // (the previous behavior). Embedded mode uses a single return_url
      // (Stripe top-navigates the parent page there once payment
      // completes) rather than separate success_url/cancel_url -- there's
      // no page-level "cancel" event in embedded mode, the customer just
      // stays on /checkout if they abandon partway through.
      const session = await stripe.checkout.sessions.create({
        // Admin-configurable (Settings > Payments) -- never hardcoded.
        // 'us_bank_account' is Stripe's ACH Direct Debit payment method --
        // Stripe's own embedded Checkout collects and verifies the bank
        // account (Financial Connections or manual micro-deposits) and
        // handles ACH mandate collection itself; Pepscore Lab never sees a
        // raw account/routing number (see AchAuthorization's schema
        // comment). An ACH payment doesn't settle synchronously the way a
        // card does -- app/api/webhooks/stripe/route.ts branches on
        // session.payment_status to hold the order at PROCESSING instead
        // of marking it paid immediately. Apple Pay/Google Pay aren't
        // separate entries here -- Stripe surfaces them automatically
        // whenever 'card' is enabled and the browser/device supports them.
        payment_method_types: paymentMethodTypes,
        mode: 'payment',
        ui_mode: 'embedded',
        ...(existingStripeCustomerId ? { customer: existingStripeCustomerId } : { customer_email: customerEmail }),
        line_items: stripeLineItems,
        // Add shipping as a line item if applicable
        ...(shippingCost > 0
          ? {
              shipping_options: [
                {
                  shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: { amount: Math.round(shippingCost * 100), currency: 'usd' },
                    display_name: 'Standard Shipping',
                  },
                },
              ],
            }
          : {}),
        metadata: {
          orderId: order.id,
          orderNumber,
          userId: userId ?? '',
          customerEmail,
        },
        return_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      })

      // Save the session ID to the order so the webhook can find it
      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      })

      return NextResponse.json({ clientSecret: session.client_secret })
    } catch (stripeErr) {
      await prisma.$transaction((tx) => releaseAllOrderReservationsTx(tx, order.id, 'storefront-checkout', 'Stripe session creation failed'))
      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
      throw stripeErr
    }
  } catch (err: unknown) {
    console.error('[checkout]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
