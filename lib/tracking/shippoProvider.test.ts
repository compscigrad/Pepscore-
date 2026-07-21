import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mapShippoStatus, shippoProvider } from './shippoProvider'

describe('mapShippoStatus', () => {
  it('maps a delivered status', () => {
    expect(mapShippoStatus('DELIVERED', 'Delivered, in/at mailbox')).toBe('DELIVERED')
  })

  it('maps a delivered status even from status_details alone', () => {
    expect(mapShippoStatus('UNKNOWN', 'Package delivered to recipient')).toBe('DELIVERED')
  })

  it('maps a returned-to-sender status', () => {
    expect(mapShippoStatus('RETURNED', 'Being returned to sender')).toBe('RETURNED_TO_SENDER')
  })

  it('maps an out-for-delivery status', () => {
    expect(mapShippoStatus('TRANSIT', 'Out for delivery today')).toBe('OUT_FOR_DELIVERY')
  })

  it('maps a delayed status', () => {
    expect(mapShippoStatus('TRANSIT', 'Shipment delay due to weather')).toBe('DELAYED')
  })

  it('maps a delivery exception', () => {
    expect(mapShippoStatus('FAILURE', 'Delivery exception: address issue')).toBe('DELIVERY_EXCEPTION')
  })

  it('maps a plain in-transit status', () => {
    expect(mapShippoStatus('TRANSIT', 'Departed facility')).toBe('IN_TRANSIT')
  })

  it('maps pre-transit to accepted by carrier', () => {
    expect(mapShippoStatus('PRE_TRANSIT', 'Label created')).toBe('ACCEPTED_BY_CARRIER')
  })

  it('falls back to UNKNOWN for an unrecognized status', () => {
    expect(mapShippoStatus('', '')).toBe('UNKNOWN')
  })
})

describe('shippoProvider.verifyWebhook', () => {
  const originalSecret = process.env.SHIPPO_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.SHIPPO_WEBHOOK_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.SHIPPO_WEBHOOK_SECRET = originalSecret
  })

  it('rejects a request with no token', async () => {
    const req = new Request('https://example.com/api/webhooks/shippo')
    expect(await shippoProvider.verifyWebhook(req)).toBe(false)
  })

  it('rejects a request with the wrong token', async () => {
    const req = new Request('https://example.com/api/webhooks/shippo?token=wrong')
    expect(await shippoProvider.verifyWebhook(req)).toBe(false)
  })

  it('accepts a request with the correct token', async () => {
    const req = new Request('https://example.com/api/webhooks/shippo?token=test-secret')
    expect(await shippoProvider.verifyWebhook(req)).toBe(true)
  })

  it('rejects everything if no secret is configured', async () => {
    delete process.env.SHIPPO_WEBHOOK_SECRET
    const req = new Request('https://example.com/api/webhooks/shippo?token=anything')
    expect(await shippoProvider.verifyWebhook(req)).toBe(false)
  })
})

describe('shippoProvider.normalizeWebhookPayload', () => {
  it('normalizes a wrapped {data: {...}} webhook payload into events', () => {
    const payload = {
      data: {
        tracking_number: '123',
        carrier: 'usps',
        tracking_status: { status: 'TRANSIT', status_details: 'In transit', status_date: '2026-07-20T12:00:00Z' },
        tracking_history: [
          { object_id: 'evt_1', status: 'PRE_TRANSIT', status_details: 'Label created', status_date: '2026-07-18T12:00:00Z' },
          { object_id: 'evt_2', status: 'TRANSIT', status_details: 'In transit', status_date: '2026-07-20T12:00:00Z' },
        ],
      },
    }
    const events = shippoProvider.normalizeWebhookPayload(payload)
    expect(events).toHaveLength(2)
    expect(events[0].normalizedStatus).toBe('ACCEPTED_BY_CARRIER')
    expect(events[1].normalizedStatus).toBe('IN_TRANSIT')
  })

  it('returns an empty array for a payload with no tracking history', () => {
    const events = shippoProvider.normalizeWebhookPayload({ data: { tracking_number: '123', carrier: 'usps' } })
    expect(events).toEqual([])
  })
})
