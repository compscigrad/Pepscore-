'use client'

// Add/remove/set-default for saved payment methods. "Add" mounts Stripe's
// embedded setup Checkout in-page (same EmbeddedCheckoutProvider pattern
// as components/storefront/CheckoutForm.tsx, just mode: 'setup' instead
// of 'payment') -- one UI pattern reused, not a second one built from scratch.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { getStripeClient } from '@/lib/stripe-client'

export interface PortalSavedPaymentMethod {
  id: string
  methodType: string
  isDefault: boolean
  cardBrand: string | null
  cardLast4: string | null
  cardExpMonth: number | null
  cardExpYear: number | null
  bankName: string | null
  bankAccountLast4: string | null
}

function describeMethod(m: PortalSavedPaymentMethod): string {
  if (m.methodType === 'ACH') {
    return `${m.bankName ?? 'Bank account'} •••• ${m.bankAccountLast4 ?? '····'}`
  }
  const brand = m.cardBrand ? m.cardBrand[0].toUpperCase() + m.cardBrand.slice(1) : 'Card'
  return `${brand} •••• ${m.cardLast4 ?? '····'}`
}

export function PortalPaymentMethodsSection({ initialMethods }: { initialMethods: PortalSavedPaymentMethod[] }) {
  const [methods, setMethods] = useState(initialMethods)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addClientSecret, setAddClientSecret] = useState<string | null>(null)
  const [startingAdd, setStartingAdd] = useState(false)

  async function refresh() {
    const res = await fetch('/api/account/payment-methods')
    if (res.ok) {
      const data = await res.json()
      setMethods(data.methods)
    }
  }

  async function startAdd() {
    setStartingAdd(true)
    try {
      const res = await fetch('/api/account/payment-methods', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start')
      setAddClientSecret(data.clientSecret)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start adding a payment method')
    } finally {
      setStartingAdd(false)
    }
  }

  async function setDefault(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/account/payment-methods/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to update')
      toast.success('Default payment method updated')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/account/payment-methods/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to remove')
      toast.success('Payment method removed')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setBusyId(null)
    }
  }

  if (addClientSecret) {
    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-2 sm:p-6">
        <EmbeddedCheckoutProvider stripe={getStripeClient()} options={{ clientSecret: addClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {methods.length === 0 ? (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/50 text-sm">No saved payment methods yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div>
                <p className="text-sm text-white font-heading font-bold">{describeMethod(m)}</p>
                {m.methodType === 'CARD' && m.cardExpMonth && m.cardExpYear && (
                  <p className="text-xs text-white/40">
                    Expires {String(m.cardExpMonth).padStart(2, '0')}/{m.cardExpYear}
                  </p>
                )}
                {m.isDefault && (
                  <span className="inline-block mt-1 text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-gold/10 text-gold">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!m.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(m.id)}
                    disabled={busyId === m.id}
                    className="text-xs font-heading font-bold text-white/60 hover:text-white disabled:opacity-50"
                  >
                    Set Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  disabled={busyId === m.id}
                  className="text-xs font-heading font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={startAdd}
        disabled={startingAdd}
        className="w-full bg-gold hover:bg-gold-dark disabled:opacity-50 text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-3 rounded-full transition-colors"
      >
        {startingAdd ? 'Starting…' : '+ Add Payment Method'}
      </button>
    </div>
  )
}
