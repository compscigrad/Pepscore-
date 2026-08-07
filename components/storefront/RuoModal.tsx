// RUO compliance acknowledgment modal — shown before Stripe Checkout
// Customer must check the box and click Continue before payment proceeds
'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface RuoModalProps {
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export const RUO_TEXT =
  'I confirm that I am a qualified researcher purchasing these products for legitimate research purposes only. I acknowledge that all Pepscore Lab products are for Research Use Only (RUO). They are NOT intended for human use, human consumption, diagnostic use, therapeutic use, or veterinary use. I will handle all products in accordance with applicable laws and regulations.'

export function RuoModal({ onConfirm, onCancel, isLoading }: RuoModalProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#0d0d0d] border border-[#D4AF37]/20 rounded-2xl max-w-[520px] w-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">

        {/* Warning header */}
        <div className="bg-amber-400/10 border-b border-amber-400/25 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-400 flex-shrink-0" size={22} />
          <div>
            <h2 className="font-heading text-[15px] font-bold text-white">Research Use Only — Required Acknowledgment</h2>
            <p className="text-[12px] text-white/50 mt-0.5">You must confirm compliance before checkout</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="bg-white/[0.04] rounded-lg p-4 text-[13px] text-white/65 leading-relaxed mb-5">
            {RUO_TEXT}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer"
            />
            <span className="text-[13px] text-white/80 leading-relaxed select-none">
              I have read and agree to the above Research Use Only terms. I understand that misuse of these research compounds is prohibited.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-white/20 text-white/70 font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!checked || isLoading}
            className="flex-1 bg-gradient-to-br from-[#D4AF37] to-[#E8C84A] disabled:opacity-40 disabled:cursor-not-allowed text-black font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full transition-all"
          >
            {isLoading ? 'Processing…' : 'Continue to Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
