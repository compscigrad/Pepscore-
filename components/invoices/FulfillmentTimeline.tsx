// Order-detail fulfillment timeline (2026-08-13 Command Center). Renders
// only real InvoiceActivityLog rows already on the invoice -- no fabricated
// timestamps, no synthetic "order placed" entry that isn't actually backed
// by a log row. Filtered to fulfillment-relevant event types so this stays
// a shipping/label/alert timeline, not a duplicate of every field edit ever
// made to the invoice.
import { card, sectionHeading } from './theme'

interface ActivityLogRow {
  id: string
  eventType: string
  previousValue: string | null
  newValue: string | null
  carrier: string | null
  trackingNumber: string | null
  source: string
  createdAt: string | Date
}

// Explicit allow-list, not a prefix match -- the real eventType vocabulary
// in InvoiceActivityLog is inconsistent (e.g. "SHIPPING_STATUS_UPDATED" vs
// "SHIPMENT_VOIDED" vs "MARKED_DELIVERED_MANUALLY"), so prefix matching
// would either miss real events or pull in unrelated ones. Sourced from an
// actual grep of every logActivity()/InvoiceActivityLog.create() call site
// across lib/tracking, lib/fulfillment, and lib/backorders.
const RELEVANT_EVENT_TYPES = new Set([
  'TRACKING_ADDED',
  'TRACKING_REMOVED',
  'SHIPPING_STATUS_UPDATED',
  'SHIPPING_STATUS_UPDATE_SUPPRESSED_BY_BACKORDER',
  'SHIPMENT_DELIVERED',
  'SHIPMENT_VOIDED',
  'MARKED_DELIVERED_MANUALLY',
  'STATUS_OVERRIDDEN',
  'LABEL_PURCHASED',
  'FULFILLMENT_OVERRIDE',
  'BACKORDER_APPLIED',
  'BACKORDER_RESOLVED',
  'BACKORDER_AUTOMATIC_COMPENSATION_NOT_APPLIED',
  'FULFILLMENT_ALERT_RAISED',
  'FULFILLMENT_ALERT_RESOLVED',
])

const EVENT_LABEL: Record<string, string> = {
  FULFILLMENT_ALERT_RAISED: 'Alert raised',
  FULFILLMENT_ALERT_RESOLVED: 'Alert resolved',
}

function readableEventType(eventType: string): string {
  if (EVENT_LABEL[eventType]) return EVENT_LABEL[eventType]
  return eventType
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function FulfillmentTimeline({ entries }: { entries: ActivityLogRow[] }) {
  // entries arrives newest-first (Invoice.activityLog's own query order) --
  // reversed here so the timeline reads chronologically, oldest to newest.
  const relevant = entries.filter((e) => RELEVANT_EVENT_TYPES.has(e.eventType)).slice().reverse()

  if (relevant.length === 0) return null

  return (
    <div className={`${card} p-6`}>
      <h2 className={`${sectionHeading} mb-4`}>Fulfillment Timeline</h2>
      <div className="space-y-3">
        {relevant.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 text-[13px]">
            <span className="text-white/30 whitespace-nowrap tabular-nums pt-0.5">
              {new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
            <div className="min-w-0">
              <span className="text-white/80 font-semibold">{readableEventType(entry.eventType)}</span>
              {entry.newValue && <span className="text-white/50"> — {entry.newValue}</span>}
              {entry.trackingNumber && <span className="text-white/40"> · {entry.carrier ?? ''} {entry.trackingNumber}</span>}
              <span className="text-white/25 text-[11px] ml-2 uppercase tracking-wide">{entry.source.toLowerCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
