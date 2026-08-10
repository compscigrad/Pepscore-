// Checkout page — shows cart summary, collects shipping address, shows
// RUO acknowledgment modal, then renders Stripe's embedded Checkout
// in-page (no more full-page redirect to a Stripe-hosted URL). Rendered
// only when the storefront checkout kill switch is on (app/checkout/
// page.tsx is the server-side gate) -- see lib/storefront/checkoutGate.ts.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useCartStore } from '@/lib/cart-store'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { RuoModal, RUO_TEXT } from '@/components/storefront/RuoModal'
import { CartSidebar } from '@/components/storefront/CartSidebar'
import { BackorderIndicator } from '@/components/storefront/BackorderIndicator'
import { BackorderLegend } from '@/components/storefront/BackorderLegend'
import { STOREFRONT_BACKORDER_CREDIT_AMOUNT, STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL } from '@/lib/storefront/backorderPolicy'
import { getStripeClient } from '@/lib/stripe-client'

const fieldInput =
  'w-full border border-white/15 bg-white/[0.04] rounded-lg px-4 py-3 text-[14px] text-white placeholder:text-white/35 focus:outline-none focus:border-[#D4AF37]/50 transition-colors'
const fieldLabel = 'block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/45 mb-1.5'

interface AddressForm {
  name: string
  email: string
  phone: string
  street1: string
  street2: string
  city: string
  state: string
  zip: string
  country: string
}

const EMPTY_FORM: AddressForm = {
  name: '', email: '', phone: '',
  street1: '', street2: '',
  city: '', state: '', zip: '', country: 'US',
}

export function CheckoutForm() {
  const router = useRouter()
  const { items, total } = useCartStore()
  const cartTotal = total()
  const hasBackorderedItem = items.some((i) => i.backordered)
  // Storefront-side hint only -- the authoritative eligibility check happens
  // server-side against the real invoice once one exists (lib/invoice/
  // backorder.ts's isAutomaticCompensationEligible).
  const qualifiesForBackorderCredit = hasBackorderedItem && cartTotal > STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL

  const [form, setForm] = useState<AddressForm>(EMPTY_FORM)
  const [showRuo, setShowRuo] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // Promotion code (Phase 4A Critical #1). appliedCode is the exact string
  // sent to /api/checkout on confirm -- discountAmount here is a preview
  // only, shown for the customer's benefit; checkout always re-resolves
  // the authoritative amount server-side and never trusts this value.
  const [promoInput, setPromoInput] = useState('')
  const [promoChecking, setPromoChecking] = useState(false)
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [promoDiscountAmount, setPromoDiscountAmount] = useState(0)
  const [promoCampaignTitle, setPromoCampaignTitle] = useState<string | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  if (items.length === 0) {
    return (
      <>
        <CartSidebar />
        <Header />
        <main className="bg-black min-h-[60vh] flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🧪</p>
            <h2 className="font-heading text-xl font-bold mb-2 text-white">Your cart is empty</h2>
            <button
              onClick={() => router.push('/#products')}
              className="mt-4 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-full transition-all hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)]"
            >
              Shop Products
            </button>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function validate(): boolean {
    const required: (keyof AddressForm)[] = ['name','email','street1','city','state','zip','country']
    for (const key of required) {
      if (!form[key].trim()) {
        toast.error(`Please fill in ${key.replace(/([A-Z])/g,' $1').toLowerCase()}`)
        return false
      }
    }
    if (!form.email.includes('@')) { toast.error('Please enter a valid email address'); return false }
    return true
  }

  function handleCheckoutClick() {
    if (!validate()) return
    setShowRuo(true)
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return
    if (!form.email.includes('@')) {
      toast.error('Enter your email above first, so we can check this code against your account.')
      return
    }
    setPromoChecking(true)
    setPromoError(null)
    try {
      const res = await fetch('/api/promotions/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput,
          email: form.email,
          cartSubtotal: cartTotal,
          cartProductSlugs: items.map((i) => i.slug),
        }),
      })
      const data = await res.json()
      if (!data.valid) {
        setPromoError(data.message ?? "That code isn't valid.")
        return
      }
      setAppliedCode(promoInput.trim().toUpperCase())
      setPromoDiscountAmount(data.discountAmount)
      setPromoCampaignTitle(data.campaignTitle ?? null)
      setPromoInput('')
      toast.success('Promo code applied')
    } catch {
      setPromoError('Something went wrong checking that code — please try again.')
    } finally {
      setPromoChecking(false)
    }
  }

  function handleRemovePromo() {
    setAppliedCode(null)
    setPromoDiscountAmount(0)
    setPromoCampaignTitle(null)
    setPromoError(null)
  }

  const estimatedTotal = Math.max(0, cartTotal - promoDiscountAmount)

  async function handleRuoConfirm() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            productId: i.id,
            name: i.name,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.price,
            sellUnit: i.sellUnit,
          })),
          shippingAddress: {
            name: form.name,
            street1: form.street1,
            street2: form.street2 || undefined,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country,
          },
          customerEmail: form.email,
          customerName: form.name,
          ruoAgreed: true,
          ruoText: RUO_TEXT,
          promotionCode: appliedCode ?? undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        // A promo code that stopped validating between "Apply" and payment
        // (e.g. someone else redeemed a shared-eligibility edge case, or it
        // simply expired mid-checkout) surfaces here -- clear it rather
        // than silently retrying with a now-invalid code.
        if (appliedCode && data.error) {
          setAppliedCode(null)
          setPromoDiscountAmount(0)
        }
        throw new Error(data.error ?? 'Checkout failed')
      }

      // Mounts Stripe's embedded Checkout in-page below instead of a
      // full-page redirect to a Stripe-hosted URL.
      setClientSecret(data.clientSecret)
      setShowRuo(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
      setShowRuo(false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <CartSidebar />
      {showRuo && (
        <RuoModal
          onConfirm={handleRuoConfirm}
          onCancel={() => setShowRuo(false)}
          isLoading={isLoading}
        />
      )}
      <Header />

      <main className="bg-black min-h-screen py-16 px-6">
        <div className="max-w-[1100px] mx-auto">
          <h1 className="font-heading text-3xl font-bold text-white mb-10">Checkout</h1>

          {clientSecret ? (
            // Stripe's own embedded Checkout iframe -- Pay by Bank, Card,
            // and Cash App Pay (whichever the admin has enabled, see
            // Settings > Payments) all render here, in whatever
            // presentation Stripe's own embedded UI gives them. No further
            // shipping/order-summary UI below this point -- Stripe's
            // embedded page includes its own order summary.
            <div className="bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-2xl p-2 sm:p-6">
              <EmbeddedCheckoutProvider stripe={getStripeClient()} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
          <>
          {/* RUO Notice */}
          <div className="bg-amber-400/10 border border-amber-400/25 rounded-xl p-4 mb-8 flex gap-3 items-start">
            <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-[13px] text-white/70 leading-relaxed">
              <strong className="text-white">Research Use Only:</strong> All Pepscore Lab products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. You will be required to confirm this before payment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
            {/* ── Shipping Address Form ─────────────────────────────────────── */}
            <div className="bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-2xl p-8">
              <h2 className="font-heading text-[18px] font-bold text-white mb-6">Shipping Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full name */}
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Full Name *</label>
                  <input name="name" value={form.name} onChange={handleChange}
                    className={fieldInput}
                    placeholder="Dr. Jane Smith" />
                </div>
                {/* Email */}
                <div>
                  <label className={fieldLabel}>Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    className={fieldInput}
                    placeholder="researcher@lab.edu" />
                </div>
                {/* Phone */}
                <div>
                  <label className={fieldLabel}>Phone</label>
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                    className={fieldInput}
                    placeholder="+1 (555) 000-0000" />
                </div>
                {/* Street */}
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Street Address *</label>
                  <input name="street1" value={form.street1} onChange={handleChange}
                    className={fieldInput}
                    placeholder="123 Laboratory Drive" />
                </div>
                {/* Apt/Suite */}
                <div className="sm:col-span-2">
                  <label className={fieldLabel}>Apt / Suite (optional)</label>
                  <input name="street2" value={form.street2} onChange={handleChange}
                    className={fieldInput}
                    placeholder="Suite 400" />
                </div>
                {/* City */}
                <div>
                  <label className={fieldLabel}>City *</label>
                  <input name="city" value={form.city} onChange={handleChange}
                    className={fieldInput}
                    placeholder="Miami" />
                </div>
                {/* State */}
                <div>
                  <label className={fieldLabel}>State *</label>
                  <input name="state" value={form.state} onChange={handleChange}
                    className={fieldInput}
                    placeholder="FL" maxLength={2} />
                </div>
                {/* ZIP */}
                <div>
                  <label className={fieldLabel}>ZIP Code *</label>
                  <input name="zip" value={form.zip} onChange={handleChange}
                    className={fieldInput}
                    placeholder="33101" />
                </div>
                {/* Country */}
                <div>
                  <label className={fieldLabel}>Country *</label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className={`${fieldInput} bg-[#0d0d0d]`}>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Order Summary ─────────────────────────────────────────────── */}
            <div>
              <div className="bg-[#0d0d0d] border border-[#D4AF37]/15 rounded-2xl p-6 sticky top-24">
                <h2 className="font-heading text-[18px] font-bold text-white mb-5">Order Summary</h2>
                <ul className="space-y-3 mb-5">
                  {items.map(i => (
                    <li key={i.id} className="flex justify-between items-start gap-3 text-[13px]">
                      <div>
                        <p className="font-heading font-bold text-white flex items-center gap-1.5">
                          {i.name} × {i.quantity}
                          {i.backordered && <BackorderIndicator />}
                        </p>
                        <p className="text-white/45">{i.size}</p>
                      </div>
                      <span className="font-heading font-bold text-white whitespace-nowrap">
                        ${(i.price * i.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <div className="flex justify-between text-[13px] text-white/50">
                    <span>Subtotal</span><span>${cartTotal.toFixed(2)}</span>
                  </div>
                  {promoDiscountAmount > 0 && (
                    <div className="flex justify-between text-[13px] text-[#D4AF37]">
                      <span>{promoCampaignTitle ?? 'Promotion'} ({appliedCode})</span>
                      <span>−${promoDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[13px] text-white/50">
                    <span>Shipping</span>
                    <span className="text-green-400 font-semibold">
                      {cartTotal >= 150 ? 'Free' : 'Calculated at Stripe'}
                    </span>
                  </div>
                </div>

                {/* Promotion code */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  {appliedCode ? (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-white">
                        <span className="text-[#D4AF37] font-heading font-bold">{appliedCode}</span> applied
                      </span>
                      <button type="button" onClick={handleRemovePromo} className="text-white/40 hover:text-white text-[12px] underline">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value); setPromoError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo() } }}
                        placeholder="Promo code"
                        className={`${fieldInput} py-2.5 text-[13px]`}
                      />
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        disabled={promoChecking || !promoInput.trim()}
                        className="shrink-0 px-4 rounded-lg border border-[#D4AF37]/40 text-[#D4AF37] text-[12px] font-heading font-bold uppercase tracking-wide hover:bg-[#D4AF37]/10 disabled:opacity-40"
                      >
                        {promoChecking ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="text-[11px] text-red-300 mt-2">{promoError}</p>}
                </div>

                {hasBackorderedItem && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <BackorderLegend />
                    <p className="text-[11px] text-white/45">
                      {qualifiesForBackorderCredit
                        ? `This order qualifies for a one-time $${STOREFRONT_BACKORDER_CREDIT_AMOUNT} backorder credit. Our team applies it to your invoice once your order is reviewed.`
                        : `Orders over $${STOREFRONT_BACKORDER_MINIMUM_ORDER_TOTAL} with a backordered item receive a one-time $${STOREFRONT_BACKORDER_CREDIT_AMOUNT} backorder credit, applied to your invoice once reviewed.`}
                    </p>
                  </div>
                )}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
                  <span className="font-heading font-bold text-[16px] text-white">Est. Total</span>
                  <span className="font-heading font-extrabold text-[22px] text-[#D4AF37]">${estimatedTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckoutClick}
                  className="w-full mt-6 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] text-black font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-4 rounded-full transition-all hover:shadow-[0_4px_16px_rgba(212,175,55,0.4)]"
                >
                  Confirm RUO & Pay
                </button>
                <p className="text-center text-[11px] text-white/40 mt-3">
                  Secured by Stripe · SSL encrypted
                </p>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}
