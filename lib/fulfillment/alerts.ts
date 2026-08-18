// Fulfillment alert reconciliation (2026-08-13) -- the service layer that
// turns lib/fulfillment/commandCenter.ts's pure bucket derivation into real,
// deduplicated FulfillmentAlert rows. Called from both the extended
// poll-tracking cron (scheduled reconciliation, runs with nobody logged in)
// and on-demand whenever the Command Center page loads (so a fresh page
// view never shows a stale alert state even between cron runs). Modeled
// directly on LowStockAlert's own idiom: one OPEN row per (invoice,
// alertType) at a time, enforced by a find-before-create check, never a DB
// unique constraint (RESOLVED history must be allowed to accumulate).
import { prisma } from '@/lib/prisma'
import { listFulfillmentQueue, BUCKET_LABEL, type FulfillmentBucket, type FulfillmentQueueRow } from './commandCenter'
import type { FulfillmentAlertType } from '@prisma/client'

// Which alert type (if any) a bucket should have open right now. Buckets
// not listed here (NEEDS_FULFILLMENT, IN_TRANSIT, DELIVERED) are healthy/
// expected states -- no alert, and any previously-open alert for that
// invoice gets resolved below.
export function alertTypeForBucket(row: FulfillmentQueueRow): FulfillmentAlertType | null {
  switch (row.bucket) {
    case 'LABEL_NEEDED':
      return 'NO_LABEL'
    case 'AWAITING_CARRIER_SCAN':
      return 'AWAITING_CARRIER_SCAN'
    case 'STALLED':
      return 'STALLED_NO_MOVEMENT'
    case 'EXCEPTION':
      // Distinguishes "a shipment exists on an invoice that was refunded/
      // cancelled after the fact" (spec #39) from a genuine carrier
      // exception -- same EXCEPTION bucket, different owner-facing message
      // and alert type.
      return ['CANCELLED', 'VOID', 'REFUNDED'].includes(row.invoiceStatus) ? 'REFUNDED_AFTER_SHIPMENT' : 'CARRIER_EXCEPTION'
    default:
      return null
  }
}

export function alertMessage(row: FulfillmentQueueRow, alertType: FulfillmentAlertType): string {
  const label = `${row.invoiceNumber} (${row.customerName})`
  switch (alertType) {
    case 'NO_LABEL':
      return `Paid order ${label} has no shipping label.`
    case 'AWAITING_CARRIER_SCAN':
      return `Order ${label} has a label but carrier movement has not been detected yet.`
    case 'STALLED_NO_MOVEMENT': {
      const hrs = row.ageHours !== null ? Math.round(row.ageHours) : null
      return `Shipment for order ${label} has had no tracking movement${hrs !== null ? ` for ${hrs}h` : ''}.`
    }
    case 'CARRIER_EXCEPTION':
      return `Order ${label} has a carrier exception (${row.shipment?.normalizedStatus ?? 'unknown status'}).`
    case 'REFUNDED_AFTER_SHIPMENT':
      return `Order ${label} was refunded/cancelled after a shipment was already created -- review before any further action.`
    case 'INVENTORY_CONFLICT':
      return `Order ${label} has an inventory conflict blocking fulfillment.`
  }
}

async function writeActivityLog(invoiceId: string, eventType: string, newValue?: string) {
  await prisma.invoiceActivityLog.create({
    data: { invoiceId, eventType, newValue, source: 'SYSTEM' },
  })
}

export interface ReconcileFulfillmentAlertsResult {
  checked: number
  opened: number
  resolved: number
}

// The one function both the cron and the Command Center page call. Never
// throws for a single bad row -- one invoice's alert logic failing must
// never block reconciliation for the rest of the queue.
export async function reconcileFulfillmentAlerts(now: number = Date.now()): Promise<ReconcileFulfillmentAlertsResult> {
  const queue = await listFulfillmentQueue(now)
  let opened = 0
  let resolved = 0

  for (const row of queue) {
    try {
      const applicableType = alertTypeForBucket(row)

      const openAlerts = await prisma.fulfillmentAlert.findMany({
        where: { invoiceId: row.invoiceId, status: 'OPEN' },
      })

      for (const existing of openAlerts) {
        if (existing.alertType === applicableType) {
          // Still applicable -- just bump lastCheckedAt so the row proves
          // reconciliation is actually running, no duplicate created.
          await prisma.fulfillmentAlert.update({ where: { id: existing.id }, data: { lastCheckedAt: new Date(now) } })
        } else {
          // No longer applicable (bucket changed, or escalated to a
          // different alert type) -- resolve automatically.
          await prisma.fulfillmentAlert.update({
            where: { id: existing.id },
            data: { status: 'RESOLVED', resolvedAt: new Date(now), resolvedBy: 'system-reconciliation' },
          })
          await writeActivityLog(row.invoiceId, 'FULFILLMENT_ALERT_RESOLVED', existing.alertType)
          resolved++
        }
      }

      if (applicableType && !openAlerts.some((a) => a.alertType === applicableType)) {
        await prisma.fulfillmentAlert.create({
          data: {
            invoiceId: row.invoiceId,
            shipmentId: row.shipment?.id ?? null,
            alertType: applicableType,
            message: alertMessage(row, applicableType),
          },
        })
        await writeActivityLog(row.invoiceId, 'FULFILLMENT_ALERT_RAISED', applicableType)
        opened++
      }
    } catch (err) {
      console.error(`[fulfillment/alerts] reconciliation failed for invoice ${row.invoiceId}`, err)
    }
  }

  return { checked: queue.length, opened, resolved }
}

export interface OpenFulfillmentAlertRow {
  id: string
  invoiceId: string
  invoiceNumber: string
  customerName: string
  alertType: FulfillmentAlertType
  message: string
  createdAt: Date
  bucketLabel: string
}

// Dashboard/"Needs Attention" reader -- OPEN alerts joined with just enough
// invoice context to link/display, newest-first within severity (callers
// sort further if needed).
export async function listOpenFulfillmentAlerts(): Promise<OpenFulfillmentAlertRow[]> {
  const alerts = await prisma.fulfillmentAlert.findMany({
    where: { status: 'OPEN' },
    include: { invoice: { select: { invoiceNumber: true, customerName: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return alerts.map((a) => ({
    id: a.id,
    invoiceId: a.invoiceId,
    invoiceNumber: a.invoice.invoiceNumber,
    customerName: a.invoice.customerName,
    alertType: a.alertType,
    message: a.message,
    createdAt: a.createdAt,
    bucketLabel: ALERT_TYPE_BUCKET_LABEL[a.alertType],
  }))
}

const ALERT_TYPE_BUCKET_LABEL: Record<FulfillmentAlertType, string> = {
  NO_LABEL: BUCKET_LABEL.LABEL_NEEDED,
  AWAITING_CARRIER_SCAN: BUCKET_LABEL.AWAITING_CARRIER_SCAN,
  STALLED_NO_MOVEMENT: BUCKET_LABEL.STALLED,
  CARRIER_EXCEPTION: BUCKET_LABEL.EXCEPTION,
  REFUNDED_AFTER_SHIPMENT: BUCKET_LABEL.EXCEPTION,
  INVENTORY_CONFLICT: BUCKET_LABEL.EXCEPTION,
}

// Re-exported for callers that want the bucket type alongside alerts.
export type { FulfillmentBucket }
