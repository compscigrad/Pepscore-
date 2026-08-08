// [Roadmap] Saved payment methods -- a portal customer can save a
// reusable card or bank account and reuse it at a future checkout.
// "Add payment method" reuses the exact same embedded-Checkout mechanism
// task #170 built for real purchases (mode: 'setup' instead of
// 'payment'), so there's no second UI pattern to build or trust --
// Stripe's own embedded Checkout collects and verifies the card/bank
// account; this file only ever stores the resulting PaymentMethod id and
// safe display metadata Stripe hands back. Pepscore Lab never sees or
// stores a raw card/account/routing number.
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import type { Customer, SavedPaymentMethod } from '@prisma/client'
import type Stripe from 'stripe'

export async function getOrCreateStripeCustomer(customer: Pick<Customer, 'id' | 'stripeCustomerId' | 'email' | 'firstName' | 'lastName'>): Promise<string> {
  if (customer.stripeCustomerId) return customer.stripeCustomerId

  const stripeCustomer = await stripe.customers.create({
    email: customer.email ?? undefined,
    name: `${customer.firstName} ${customer.lastName}`.trim(),
    metadata: { pepscoreCustomerId: customer.id },
  })

  await prisma.customer.update({ where: { id: customer.id }, data: { stripeCustomerId: stripeCustomer.id } })
  return stripeCustomer.id
}

export interface CreateAddPaymentMethodSessionInput {
  customer: Pick<Customer, 'id' | 'stripeCustomerId' | 'email' | 'firstName' | 'lastName'>
  returnUrl: string
}

// mode: 'setup' -- collects and verifies a payment method without
// charging anything, the Stripe-native way to save a method for later
// (as opposed to mode: 'payment', which task #170's checkout flow uses).
export async function createAddPaymentMethodSession(input: CreateAddPaymentMethodSessionInput): Promise<{ clientSecret: string | null }> {
  const stripeCustomerId = await getOrCreateStripeCustomer(input.customer)

  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    ui_mode: 'embedded',
    customer: stripeCustomerId,
    payment_method_types: ['card', 'us_bank_account'],
    return_url: input.returnUrl,
  })

  return { clientSecret: session.client_secret }
}

function extractDisplayMetadata(pm: Stripe.PaymentMethod): {
  methodType: 'CARD' | 'ACH'
  cardBrand?: string
  cardLast4?: string
  cardExpMonth?: number
  cardExpYear?: number
  bankName?: string
  bankAccountLast4?: string
  bankAccountType?: string
} {
  if (pm.card) {
    return { methodType: 'CARD', cardBrand: pm.card.brand, cardLast4: pm.card.last4, cardExpMonth: pm.card.exp_month, cardExpYear: pm.card.exp_year }
  }
  if (pm.us_bank_account) {
    return {
      methodType: 'ACH',
      bankName: pm.us_bank_account.bank_name ?? undefined,
      bankAccountLast4: pm.us_bank_account.last4 ?? undefined,
      bankAccountType: pm.us_bank_account.account_type ?? undefined,
    }
  }
  // Shouldn't happen given payment_method_types above, but never crash the
  // capture flow over an unrecognized method shape -- record it minimally.
  return { methodType: 'CARD' }
}

// Called when the customer returns from the embedded setup Checkout
// Session (return_url) -- retrieves the real PaymentMethod Stripe
// collected and persists only its id + safe display metadata. The first
// method a customer ever saves becomes their default automatically;
// later ones don't, until they explicitly set one.
export async function capturePaymentMethodFromSession(sessionId: string, customerId: string): Promise<SavedPaymentMethod | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['setup_intent'] })
  const setupIntent = session.setup_intent
  if (!setupIntent || typeof setupIntent === 'string') return null

  const paymentMethodId = typeof setupIntent.payment_method === 'string' ? setupIntent.payment_method : setupIntent.payment_method?.id
  if (!paymentMethodId) return null

  // Idempotent: a page refresh or repeat visit to the return URL for the
  // same session must never create a duplicate row.
  const existing = await prisma.savedPaymentMethod.findUnique({ where: { stripePaymentMethodId: paymentMethodId } })
  if (existing) return existing

  const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
  const display = extractDisplayMetadata(pm)

  const existingCount = await prisma.savedPaymentMethod.count({ where: { customerId, removedAt: null } })

  return prisma.savedPaymentMethod.create({
    data: {
      customerId,
      stripePaymentMethodId: paymentMethodId,
      methodType: display.methodType,
      isDefault: existingCount === 0,
      cardBrand: display.cardBrand,
      cardLast4: display.cardLast4,
      cardExpMonth: display.cardExpMonth,
      cardExpYear: display.cardExpYear,
      bankName: display.bankName,
      bankAccountLast4: display.bankAccountLast4,
      bankAccountType: display.bankAccountType,
    },
  })
}

export async function listSavedPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
  return prisma.savedPaymentMethod.findMany({
    where: { customerId, removedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })
}

export class SavedPaymentMethodError extends Error {}

// Ownership-checked -- always scoped to the calling customer's id, never
// just a bare method id, so a customer can never remove/promote another
// customer's saved method by guessing an id.
export async function removeSavedPaymentMethod(id: string, customerId: string): Promise<void> {
  const method = await prisma.savedPaymentMethod.findUnique({ where: { id } })
  if (!method || method.customerId !== customerId || method.removedAt) {
    throw new SavedPaymentMethodError('Payment method not found.')
  }

  try {
    await stripe.paymentMethods.detach(method.stripePaymentMethodId)
  } catch (err) {
    // Already detached on Stripe's side (e.g. a prior partial failure) --
    // proceed to soft-delete locally rather than leaving a method the
    // customer can't remove stuck forever.
    console.error('[removeSavedPaymentMethod] Stripe detach failed:', err)
  }

  await prisma.savedPaymentMethod.update({ where: { id }, data: { removedAt: new Date(), isDefault: false } })

  // Promote the next-most-recent remaining method to default so the
  // customer isn't left with none marked default while they still have
  // other saved methods on file.
  if (method.isDefault) {
    const next = await prisma.savedPaymentMethod.findFirst({
      where: { customerId, removedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    if (next) {
      await prisma.savedPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } })
    }
  }
}

export async function setDefaultPaymentMethod(id: string, customerId: string): Promise<void> {
  const method = await prisma.savedPaymentMethod.findUnique({ where: { id } })
  if (!method || method.customerId !== customerId || method.removedAt) {
    throw new SavedPaymentMethodError('Payment method not found.')
  }
  if (method.isDefault) return // idempotent no-op

  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({ where: { customerId, removedAt: null }, data: { isDefault: false } }),
    prisma.savedPaymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ])
}
