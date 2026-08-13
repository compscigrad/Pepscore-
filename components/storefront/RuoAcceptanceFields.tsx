// Shared presentational body for every RUO/21+ acceptance surface (the
// pre-checkout RuoModal and, as of 2026-08-12, the pre-signup RuoSignupGate)
// -- one copy of the intro text, the two required checkboxes, and the
// Terms/Privacy links, so the two surfaces can never drift out of sync.
// Purely controlled: this component holds no state of its own.
'use client'

import Link from 'next/link'
import { RUO_INTRO_TEXT, RUO_AGE_TEXT } from '@/lib/compliance/ruo'

interface RuoAcceptanceFieldsProps {
  ageConfirmed: boolean
  onAgeChange: (checked: boolean) => void
  agreementConfirmed: boolean
  onAgreementChange: (checked: boolean) => void
  ageInputId: string
  agreementInputId: string
}

export function RuoAcceptanceFields({
  ageConfirmed,
  onAgeChange,
  agreementConfirmed,
  onAgreementChange,
  ageInputId,
  agreementInputId,
}: RuoAcceptanceFieldsProps) {
  return (
    <>
      <p className="text-[13px] text-white/70 leading-relaxed mb-5">{RUO_INTRO_TEXT}</p>

      <div className="space-y-3.5">
        <label htmlFor={ageInputId} className="flex items-start gap-3 cursor-pointer">
          <input
            id={ageInputId}
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => onAgeChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer flex-shrink-0"
          />
          <span className="text-[13px] text-white/85 leading-relaxed select-none">{RUO_AGE_TEXT}</span>
        </label>

        {/* Same wording as RUO_AGREEMENT_TEXT (lib/compliance/ruo.ts) --
            duplicated here rather than rendered from the constant because
            this version embeds real Terms/Privacy links mid-sentence. Keep
            both in sync if the copy changes. target="_blank" so opening
            either page never loses pending gate/signup state in this tab. */}
        <label htmlFor={agreementInputId} className="flex items-start gap-3 cursor-pointer">
          <input
            id={agreementInputId}
            type="checkbox"
            checked={agreementConfirmed}
            onChange={(e) => onAgreementChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#D4AF37] cursor-pointer flex-shrink-0"
          />
          <span className="text-[13px] text-white/85 leading-relaxed select-none">
            I agree that products and information on this website are provided for laboratory research use only
            and are not intended for use in or on humans or animals. I will not use any products or information
            from this website for diagnosis, treatment, cure, or prevention of any condition. I agree to follow
            applicable laws and regulations, and I agree to the{' '}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#D4AF37] hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>
    </>
  )
}
