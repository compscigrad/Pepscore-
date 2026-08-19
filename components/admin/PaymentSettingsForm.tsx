'use client'

// Settings > Payments -- admin control for which checkout methods are
// live, plus read-only provider status and real processing-cost
// analytics. cardEnabled/achEnabled/cashAppEnabled actually gate
// app/api/checkout/route.ts's Stripe payment_method_types; the other
// toggles are readiness-only (see PaymentSettings' schema comment).
import { useState } from 'react'
import toast from 'react-hot-toast'
import { card, sectionHeading, mutedText, divider } from '@/components/invoices/theme'

export interface PaymentSettingsFormProps {
  initialSettings: {
    cardEnabled: boolean
    achEnabled: boolean
    cashAppEnabled: boolean
    applePayEnabled: boolean
    googlePayEnabled: boolean
    paypalEnabled: boolean
    venmoEnabled: boolean
  }
  providerStatus: {
    stripeConfigured: boolean
    stripeTestMode: boolean
    storefrontCheckoutEnabled: boolean
  }
  analytics: {
    byMethod: { methodType: string; provider: string; count: number; totalAmount: number; totalFees: number; averageFee: number; netRevenue: number }[]
    totalRevenue: number
    totalFees: number
    netRevenue: number
    totalRefundedAmount: number
    achVsCard: { achCount: number; achTotalAmount: number; achActualFees: number; achEquivalentAsCardFees: number; savingsFromAchAdoption: number } | null
  }
}

const METHOD_LABEL: Record<string, string> = {
  CARD: 'Card',
  ACH: 'Pay by Bank (ACH)',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  CASH_APP: 'Cash App Pay',
  PAYPAL: 'PayPal',
  VENMO: 'Venmo',
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`font-heading text-[10px] font-bold tracking-[0.06em] uppercase px-2.5 py-1 rounded-full ${ok ? 'bg-green-400/10 text-green-300' : 'bg-white/5 text-white/40'}`}>
      {label}
    </span>
  )
}

export function PaymentSettingsForm({ initialSettings, providerStatus, analytics }: PaymentSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)

  async function toggle(key: keyof typeof settings) {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Payment settings saved')
    } catch (err) {
      setSettings(settings) // revert on failure
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className={`${card} p-6`}>
        <h2 className={`${sectionHeading} mb-4`}>Provider Status</h2>
        <div className="flex flex-wrap gap-3">
          <StatusPill ok={providerStatus.stripeConfigured} label={providerStatus.stripeConfigured ? 'Stripe Configured' : 'Stripe Not Configured'} />
          <StatusPill ok={providerStatus.stripeTestMode} label={providerStatus.stripeTestMode ? 'Test Mode' : 'Live Mode'} />
          <StatusPill ok={providerStatus.storefrontCheckoutEnabled} label={providerStatus.storefrontCheckoutEnabled ? 'Checkout Enabled' : 'Checkout Disabled'} />
        </div>
        <p className={`text-xs ${mutedText} mt-3`}>
          Checkout stays disabled until <code>STOREFRONT_CHECKOUT_ENABLED</code> is explicitly set — that switch is not editable here.
        </p>
      </div>

      <div className={`${card} p-6`}>
        <h2 className={`${sectionHeading} mb-1`}>Checkout Payment Methods</h2>
        <p className={`text-xs ${mutedText} mb-4`}>
          Card, Pay by Bank, Cash App Pay, and PayPal directly control what Stripe Checkout offers. Apple Pay / Google Pay ride
          on Card automatically (no separate Stripe toggle exists) — shown here for status only. Venmo has no Stripe Checkout
          integration at all.
        </p>
        <div className={`divide-y ${divider}`}>
          {(
            [
              ['cardEnabled', 'CARD', null],
              ['achEnabled', 'ACH', null],
              ['cashAppEnabled', 'CASH_APP', null],
              ['paypalEnabled', 'PAYPAL', 'Also requires PayPal enabled for this Stripe account (Stripe Dashboard) before it actually works'],
              ['applePayEnabled', 'APPLE_PAY', 'Readiness only — rides on Card automatically, not an independent toggle'],
              ['googlePayEnabled', 'GOOGLE_PAY', 'Readiness only — rides on Card automatically, not an independent toggle'],
              ['venmoEnabled', 'VENMO', 'Readiness only — no Stripe Checkout payment method exists for Venmo'],
            ] as const
          ).map(([key, methodKey, note]) => (
            <label key={key} className="flex items-center justify-between gap-4 py-3 cursor-pointer">
              <div>
                <p className="text-sm text-white/80">{METHOD_LABEL[methodKey]}</p>
                {note && <p className={`text-[11px] ${mutedText}`}>{note}</p>}
              </div>
              <input type="checkbox" checked={settings[key]} disabled={saving} onChange={() => toggle(key)} className="accent-gold" />
            </label>
          ))}
        </div>
      </div>

      <div className={`${card} p-6`}>
        <h2 className={`${sectionHeading} mb-4`}>Processing-Cost Analytics</h2>
        {analytics.byMethod.length === 0 ? (
          <p className={`text-sm ${mutedText}`}>No completed payments yet — analytics will populate once real transactions exist.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${mutedText}`}>Total Revenue</p>
                <p className="font-heading text-lg font-bold text-white">{fmt(analytics.totalRevenue)}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${mutedText}`}>Total Fees</p>
                <p className="font-heading text-lg font-bold text-white">{fmt(analytics.totalFees)}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${mutedText}`}>Net Revenue</p>
                <p className="font-heading text-lg font-bold text-gold-dark">{fmt(analytics.netRevenue)}</p>
              </div>
              <div>
                <p className={`text-[11px] uppercase tracking-wide ${mutedText}`}>Total Refunded</p>
                <p className="font-heading text-lg font-bold text-white">{fmt(analytics.totalRefundedAmount)}</p>
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className={`border-b ${divider}`}>
                    {['Method', 'Provider', 'Count', 'Total', 'Fees', 'Avg Fee', 'Net'].map((h) => (
                      <th key={h} className={`text-left font-heading text-[11px] font-bold tracking-[0.06em] uppercase ${mutedText} px-2 py-2 whitespace-nowrap`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.byMethod.map((m) => (
                    <tr key={`${m.provider}-${m.methodType}`} className={`border-b ${divider}`}>
                      <td className="px-2 py-2 text-white whitespace-nowrap">{METHOD_LABEL[m.methodType] ?? m.methodType}</td>
                      <td className="px-2 py-2 text-white/60 whitespace-nowrap">{m.provider}</td>
                      <td className="px-2 py-2 text-white/60 whitespace-nowrap">{m.count}</td>
                      <td className="px-2 py-2 text-white/60 whitespace-nowrap">{fmt(m.totalAmount)}</td>
                      <td className="px-2 py-2 text-white/60 whitespace-nowrap">{fmt(m.totalFees)}</td>
                      <td className="px-2 py-2 text-white/60 whitespace-nowrap">{fmt(m.averageFee)}</td>
                      <td className="px-2 py-2 text-white whitespace-nowrap">{fmt(m.netRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {analytics.achVsCard && (
              <div className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                <p className="font-heading text-sm font-bold text-gold-dark mb-2">ACH vs. Card Savings</p>
                <p className={`text-xs ${mutedText} mb-1`}>
                  {analytics.achVsCard.achCount} ACH payment{analytics.achVsCard.achCount === 1 ? '' : 's'} totaling {fmt(analytics.achVsCard.achTotalAmount)}
                </p>
                <p className="text-sm text-white">
                  Actual ACH fees: {fmt(analytics.achVsCard.achActualFees)} — would have been {fmt(analytics.achVsCard.achEquivalentAsCardFees)} as card
                </p>
                <p className="font-heading text-sm font-bold text-green-400 mt-1">
                  Saved {fmt(analytics.achVsCard.savingsFromAchAdoption)} by accepting ACH
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
