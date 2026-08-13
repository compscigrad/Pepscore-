// RUO compliance acknowledgment modal -- shown before Stripe Checkout for
// a guest (every time) or a signed-in customer who hasn't yet accepted
// the current version (see CheckoutForm.tsx / lib/compliance/ruo.ts).
// Requires two distinct affirmative checkboxes (age + RUO/Terms/Privacy
// agreement) -- neither pre-checked, neither satisfied by merely opening
// the modal or continuing to browse.
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AlertTriangle } from 'lucide-react'
import { RUO_TEXT } from '@/lib/compliance/ruo'
import { RuoAcceptanceFields } from './RuoAcceptanceFields'

interface RuoModalProps {
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

// RUO_TEXT itself now lives in lib/compliance/ruo.ts (the single source of
// truth also used server-side when recording acceptance) -- re-exported
// here so existing callers importing it from this file keep working.
export { RUO_TEXT }

export function RuoModal({ onConfirm, onCancel, isLoading }: RuoModalProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [agreementConfirmed, setAgreementConfirmed] = useState(false)
  const canContinue = ageConfirmed && agreementConfirmed

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/70">
      <div className="relative bg-gradient-to-b from-[#141414] to-[#0a0a0a] border border-[#D4AF37]/30 rounded-2xl max-w-[540px] w-full shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Extremely subtle scientific watermark -- never competes with the
            required-reading text above it. */}
        <Image
          src="/images/brand/dna-molecular-bg.png"
          alt=""
          fill
          aria-hidden="true"
          className="object-cover object-right opacity-[0.04] pointer-events-none"
          sizes="540px"
        />

        {/* Header */}
        <div className="relative bg-amber-400/10 border-b border-amber-400/25 px-6 py-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-400 flex-shrink-0" size={22} />
          <div>
            <h2 className="font-heading text-[15px] font-bold text-white flex items-center gap-2">
              <Image src="/images/email-logo-mark.png" alt="" width={16} height={16} className="w-4 h-4" />
              Research Use Agreement
            </h2>
            <p className="text-[12px] text-white/50 mt-0.5">Confirmation required before checkout</p>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-6 py-5">
          <RuoAcceptanceFields
            ageConfirmed={ageConfirmed}
            onAgeChange={setAgeConfirmed}
            agreementConfirmed={agreementConfirmed}
            onAgreementChange={setAgreementConfirmed}
            ageInputId="ruo-modal-age"
            agreementInputId="ruo-modal-agreement"
          />
        </div>

        {/* Actions */}
        <div className="relative px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-white/20 text-white/70 font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canContinue || isLoading}
            className="flex-1 bg-gradient-to-br from-[#F6D365] via-[#D4AF37] to-[#C99A20] disabled:opacity-40 disabled:cursor-not-allowed text-black font-heading text-[12px] font-bold tracking-[0.06em] uppercase py-3 rounded-full transition-all"
          >
            {isLoading ? 'Processing…' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
