// POST /api/checkout
// Creates a Stripe Checkout Session from the cart, pre-creates a PENDING order,
// stores the RUO acknowledgment, and returns the Stripe session URL.

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber, generateInvoiceNumber } from '@/lib/orders'
import type { CheckoutLineItem, ShippingAddress } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    const body = await req.json()

    const {
      items,
      shippingAddress,
      customerEmail,
      customerName,
      ruoAgreed,
      ruoText,
    }: {
      items: CheckoutLineItem[]
      shippingAddress: ShippingAddress
      customerEmail: string
      customerName: string
      ruoAgreed: boolean
      ruoText: string
    } = body

    if (!ruoAgreed) {
      return NextResponse.json({ error: 'RUO acknowledgment is required' }, { status: 400 })
    }
    if (!items?.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Resolve product records from DB to get authoritative prices
    const productIds = items.map(i => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Build validated line items using DB prices (never trust client-side prices)
    const lineItems = items.map(i => {
      const product = productMap.get(i.productId)
      if (!product) throw new Error(`Product ${i.productId} not found`)
      return {
        ...i,
        unitPrice: product.price,
        total: product.price * i.quantity,
        costOfGoods: product.costOfGoods * i.quantity,
      }
    })

    const subtotal = lineItems.reduce((s, i) => s + i.total, 0)
    const freeShipping = subtotal >= 150
    const shippingCost = freeShipping ? 0 : 0 // Shippo rates fetched post-checkout

    // Pre-create order record in PENDING state
    const orderNumber = generateOrderNumber()
    const invoiceNumber = generateInvoiceNumber()

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: userId ?? undefined,
        customerEmail,
        customerName,
        shippingAddress: JSON.parse(JSON.stringify(shippingAddress)),
        status: 'PENDING',
        subtotal,
        shippingCost,
        total: subtotal + shippingCost,
        items: {
          create: lineItems.map(i => ({
            productId: i.productId,
            name: i.name,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costOfGoods: (productMap.get(i.productId)?.costOfGoods ?? 0) * i.quantity,
            total: i.total,
          })),
        },
        invoice: {
          create: { invoiceNumber, status: 'DRAFT' },
        },
      },
    })

    // Store RUO acknowledgment
    await prisma.complianceAcknowledgment.create({
      data: {
        orderId: order.id,
        userId: userId ?? undefined,
        sessionId: undefined,
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
        ruoText,
      },
    })

    // Build Stripe line items
    const stripeLineItems = lineItems.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${i.name} (${i.size})`,
          description: 'For Research Use Only. Not for human use.',
        },
        unit_amount: Math.round(i.unitPrice * 100),
      },
      quantity: i.quantity,
    }))

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail,
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
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout`,
    })

    // Save the session ID to the order so the webhook can find it
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('[checkout]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
