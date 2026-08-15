// GET/PATCH /api/admin/payment-settings — which checkout methods are
// offered, plus the read-only provider/test-mode status the settings page
// displays. See PaymentSettings' schema comment for which fields are real
// Stripe gates vs. readiness-only display flags.
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/rbac'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getPaymentSettings, updatePaymentSettings, PaymentSettingsError } from '@/lib/payments/settings'
import { getPaymentCostAnalytics } from '@/lib/payments/analytics'
import { isStorefrontCheckoutEnabled } from '@/lib/storefront/checkoutGate'

const patchSchema = z.object({
  cardEnabled: z.boolean().optional(),
  achEnabled: z.boolean().optional(),
  cashAppEnabled: z.boolean().optional(),
  applePayEnabled: z.boolean().optional(),
  googlePayEnabled: z.boolean().optional(),
  paypalEnabled: z.boolean().optional(),
  venmoEnabled: z.boolean().optional(),
})

// Booleans/labels only -- never a secret value itself, only whether one
// appears to be configured (e.g. a Stripe test-mode key present).
function getProviderStatus() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? ''
  return {
    stripeConfigured: stripeSecretKey.length > 0,
    stripeTestMode: stripeSecretKey.startsWith('sk_test_'),
    storefrontCheckoutEnabled: isStorefrontCheckoutEnabled(),
  }
}

export async function GET() {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const [settings, analytics] = await Promise.all([getPaymentSettings(), getPaymentCostAnalytics()])
  return NextResponse.json({ settings, providerStatus: getProviderStatus(), analytics })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireAdmin()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  try {
    const body = await req.json()
    const parsed = patchSchema.parse(body)

    const settings = await updatePaymentSettings({ ...parsed, updatedBy: userId! })

    await prisma.adminAuditLog.create({
      data: { action: 'UPDATE_PAYMENT_SETTINGS', entity: 'PaymentSettings', entityId: 'singleton', adminId: userId!, details: parsed },
    })

    return NextResponse.json(settings)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: err.issues }, { status: 400 })
    }
    if (err instanceof PaymentSettingsError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[admin/payment-settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
