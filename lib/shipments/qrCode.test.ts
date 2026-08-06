import { describe, it, expect } from 'vitest'
import { describeQrCodeState } from './qrCode'

describe('describeQrCodeState', () => {
  it('is AVAILABLE whenever a qrCodeUrl came back, regardless of origin', () => {
    expect(describeQrCodeState({ qrCodeUrl: 'https://shippo.example/qr.png', qrCodeRequested: true, origin: 'LABEL_PURCHASE' })).toBe('AVAILABLE')
  })

  it('is NOT_ELIGIBLE for a real label purchase that requested but did not receive one', () => {
    expect(describeQrCodeState({ qrCodeUrl: null, qrCodeRequested: true, origin: 'LABEL_PURCHASE' })).toBe('NOT_ELIGIBLE')
  })

  it('never claims NOT_ELIGIBLE for a manually-entered shipment — it was never requested', () => {
    expect(describeQrCodeState({ qrCodeUrl: null, qrCodeRequested: false, origin: 'MANUAL_ENTRY' })).toBe('NOT_APPLICABLE')
  })

  it('is NOT_APPLICABLE for a label purchase that never requested a QR code', () => {
    expect(describeQrCodeState({ qrCodeUrl: null, qrCodeRequested: false, origin: 'LABEL_PURCHASE' })).toBe('NOT_APPLICABLE')
  })

  it('a QR request never silently becomes PDF-only without surfacing NOT_ELIGIBLE', () => {
    // The one state that must never happen: requested it, didn't get it, and
    // the UI has no way to tell the admin. describeQrCodeState guarantees
    // this combination always resolves to NOT_ELIGIBLE, never NOT_APPLICABLE.
    const state = describeQrCodeState({ qrCodeUrl: null, qrCodeRequested: true, origin: 'LABEL_PURCHASE' })
    expect(state).not.toBe('NOT_APPLICABLE')
    expect(state).toBe('NOT_ELIGIBLE')
  })
})
