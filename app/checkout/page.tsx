// Checkout page — shows cart summary, collects shipping address,
// shows RUO acknowledgment modal, then redirects to Stripe Checkout
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useCartStore } from '@/lib/cart-store'
import { Header } from '@/components/storefront/Header'
import { Footer } from '@/components/storefront/Footer'
import { RuoModal, RUO_TEXT } from '@/components/storefront/RuoModal'
import { CartSidebar } from '@/components/storefront/CartSidebar'

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

export default function CheckoutPage() {
  const router = useRouter()
  const { items, total, clearCart } = useCartStore()
  const cartTotal = total()

  const [form, setForm] = useState<AddressForm>(EMPTY_FORM)
  const [showRuo, setShowRuo] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (items.length === 0) {
    return (
      <>
        <CartSidebar />
        <Header />
        <main className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center py-20">
            <p className="text-4xl mb-4">🧪</p>
            <h2 className="font-heading text-xl font-bold mb-2">Your cart is empty</h2>
            <button
              onClick={() => router.push('/#products')}
              className="mt-4 bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-3 rounded-md transition-colors"
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
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(msg)
      setIsLoading(false)
      setShowRuo(false)
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

      <main className="bg-cream min-h-screen py-16 px-6">
        <div className="max-w-[1100px] mx-auto">
          <h1 className="font-heading text-3xl font-bold text-dark mb-10">Checkout</h1>

          {/* RUO Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex gap-3 items-start">
            <span className="text-lg flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-[13px] text-g700 leading-relaxed">
              <strong>Research Use Only:</strong> All Pepscore products are for research purposes only. Not intended for human use, consumption, diagnostic use, therapeutic use, or veterinary use. You will be required to confirm this before payment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
            {/* ── Shipping Address Form ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl p-8 shadow-sh">
              <h2 className="font-heading text-[18px] font-bold text-dark mb-6">Shipping Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full name */}
                <div className="sm:col-span-2">
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Full Name *</label>
                  <input name="name" value={form.name} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="Dr. Jane Smith" />
                </div>
                {/* Email */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Email *</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="researcher@lab.edu" />
                </div>
                {/* Phone */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Phone</label>
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="+1 (555) 000-0000" />
                </div>
                {/* Street */}
                <div className="sm:col-span-2">
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Street Address *</label>
                  <input name="street1" value={form.street1} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="123 Laboratory Drive" />
                </div>
                {/* Apt/Suite */}
                <div className="sm:col-span-2">
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Apt / Suite (optional)</label>
                  <input name="street2" value={form.street2} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="Suite 400" />
                </div>
                {/* City */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">City *</label>
                  <input name="city" value={form.city} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="Miami" />
                </div>
                {/* State */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">State *</label>
                  <input name="state" value={form.state} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="FL" maxLength={2} />
                </div>
                {/* ZIP */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">ZIP Code *</label>
                  <input name="zip" value={form.zip} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors"
                    placeholder="33101" />
                </div>
                {/* Country */}
                <div>
                  <label className="block font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-g500 mb-1.5">Country *</label>
                  <select name="country" value={form.country} onChange={handleChange}
                    className="w-full border border-g300 rounded-lg px-4 py-3 text-[14px] focus:outline-none focus:border-gold transition-colors bg-white">
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
              <div className="bg-white rounded-2xl p-6 shadow-sh sticky top-24">
                <h2 className="font-heading text-[18px] font-bold text-dark mb-5">Order Summary</h2>
                <ul className="space-y-3 mb-5">
                  {items.map(i => (
                    <li key={i.id} className="flex justify-between items-start gap-3 text-[13px]">
                      <div>
                        <p className="font-heading font-bold text-dark">{i.name} × {i.quantity}</p>
                        <p className="text-g500">{i.size}</p>
                      </div>
                      <span className="font-heading font-bold text-dark whitespace-nowrap">
                        ${(i.price * i.quantity).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-g100 pt-4 space-y-2">
                  <div className="flex justify-between text-[13px] text-g500">
                    <span>Subtotal</span><span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] text-g500">
                    <span>Shipping</span>
                    <span className="text-green-600 font-semibold">
                      {cartTotal >= 150 ? 'Free' : 'Calculated at Stripe'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-g100">
                  <span className="font-heading font-bold text-[16px]">Est. Total</span>
                  <span className="font-heading font-extrabold text-[22px] text-gold-dark">${cartTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckoutClick}
                  className="w-full mt-6 bg-gold hover:bg-gold-dark text-white font-heading text-[13px] font-bold tracking-[0.08em] uppercase py-4 rounded-md transition-colors"
                >
                  Confirm RUO & Pay
                </button>
                <p className="text-center text-[11px] text-g500 mt-3">
                  Secured by Stripe · SSL encrypted
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
