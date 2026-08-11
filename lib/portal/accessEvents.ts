// Processes verified Clerk webhook events into the CustomerAccessEvent audit
// trail (app/api/webhooks/clerk/route.ts is the only caller — this never
// runs on unverified input). One function per event shape; each is a pure
// mapping from Clerk's payload to our row, plus the customerId lookup.
//
// Idempotency: providerEventId (Clerk's svix-id) is @unique on the model.
// recordAccessEvent() lets a P2002 on that column collapse to a silent
// no-op — Clerk redelivers on any non-2xx response, so a retry of an event
// we already processed must never create a second timeline entry.
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { trackServerEvent } from '@/lib/analytics/serverTrack'
import { AnalyticsEvent } from '@/lib/analytics/events'
import type { WebhookEvent } from '@clerk/nextjs/webhooks'
import type { CustomerAccessEventType } from '@prisma/client'

export function getClerkEnvironment(): 'development' | 'production' {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  return key.startsWith('pk_live_') ? 'production' : 'development'
}

// Shared with the webhook route's failure-logging path, so a processing
// error against (say) a session.revoked event is recorded as
// SESSION_REVOKED/FAILED rather than mislabeled under an unrelated type.
// Null for event types this app doesn't track (organizations/billing/etc).
const EVENT_TYPE_MAP: Partial<Record<string, CustomerAccessEventType>> = {
  'user.created': 'USER_CREATED',
  'user.updated': 'USER_UPDATED',
  'user.deleted': 'USER_DELETED',
  'session.created': 'SESSION_CREATED',
  'session.ended': 'SESSION_ENDED',
  'session.removed': 'SESSION_REMOVED',
  'session.revoked': 'SESSION_REVOKED',
  'email.created': 'EMAIL_CREATED',
}

export function mapClerkEventType(type: string): CustomerAccessEventType | null {
  return EVENT_TYPE_MAP[type] ?? null
}

// Best-effort extraction of the Clerk user id from any event shape, for the
// webhook route's failure-logging path — never throws on an unexpected shape.
export function extractClerkUserId(eventData: unknown): string | null {
  if (!eventData || typeof eventData !== 'object') return null
  const data = eventData as Record<string, unknown>
  if (typeof data.user_id === 'string') return data.user_id
  if (typeof data.id === 'string') return data.id
  return null
}

// Clerk's User.id (the "user_..." id) -> our Customer, via User.clerkId ->
// User.id -> Customer.userId. Null is a normal, expected outcome (a Clerk
// user who has signed up/in but never claimed a portal invite) — never
// throws, never treated as an error.
async function resolveCustomerId(clerkUserId: string | null | undefined): Promise<string | null> {
  if (!clerkUserId) return null
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) return null
  const customer = await prisma.customer.findFirst({ where: { userId: user.id }, select: { id: true } })
  return customer?.id ?? null
}

interface AccessEventInput {
  clerkUserId: string | null
  clerkSessionId: string | null
  eventType: CustomerAccessEventType
  eventTimestamp: Date
  authMethod?: string | null
  deviceType?: string | null
  browserName?: string | null
  browserVersion?: string | null
  ipAddress?: string | null
  city?: string | null
  country?: string | null
  emailAddress?: string | null
  outcome?: string | null
}

async function recordAccessEvent(providerEventId: string, input: AccessEventInput): Promise<'processed' | 'duplicate'> {
  const customerId = await resolveCustomerId(input.clerkUserId)

  try {
    await prisma.customerAccessEvent.create({
      data: {
        providerEventId,
        customerId,
        clerkUserId: input.clerkUserId,
        clerkSessionId: input.clerkSessionId,
        eventType: input.eventType,
        eventTimestamp: input.eventTimestamp,
        authMethod: input.authMethod ?? null,
        deviceType: input.deviceType ?? null,
        browserName: input.browserName ?? null,
        browserVersion: input.browserVersion ?? null,
        ipAddress: input.ipAddress ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        emailAddress: input.emailAddress ?? null,
        outcome: input.outcome ?? null,
        environment: getClerkEnvironment(),
        processingStatus: 'PROCESSED',
      },
    })
    return 'processed'
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'duplicate'
    }
    throw err
  }
}

function primaryEmail(user: { email_addresses?: { id: string; email_address: string }[] | null; primary_email_address_id?: string | null }): string | null {
  const list = user.email_addresses ?? []
  const primary = list.find((e) => e.id === user.primary_email_address_id)
  return primary?.email_address ?? list[0]?.email_address ?? null
}

// Central dispatch — one entry point the webhook route calls per verified
// event. Organization/role/permission/billing/waitlist events are outside
// this app's usage of Clerk and are intentionally not handled here.
export async function processClerkWebhookEvent(event: WebhookEvent, providerEventId: string, receivedHttpTimestamp: Date): Promise<'processed' | 'duplicate' | 'skipped'> {
  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const outcome = await recordAccessEvent(providerEventId, {
        clerkUserId: event.data.id,
        clerkSessionId: null,
        eventType: event.type === 'user.created' ? 'USER_CREATED' : 'USER_UPDATED',
        eventTimestamp: new Date(event.data.updated_at ?? event.data.created_at ?? Date.now()),
        emailAddress: primaryEmail(event.data),
      })
      // 'duplicate' means this is a Clerk redelivery of an event already
      // processed once (see module comment) -- only a genuinely new
      // 'processed' user.created should ever count as a real signup.
      if (event.type === 'user.created' && outcome === 'processed') {
        void trackServerEvent(AnalyticsEvent.ACCOUNT_CREATED, {})
      }
      return outcome
    }
    case 'user.deleted': {
      return recordAccessEvent(providerEventId, {
        clerkUserId: event.data.id ?? null,
        clerkSessionId: null,
        eventType: 'USER_DELETED',
        eventTimestamp: receivedHttpTimestamp,
      })
    }
    case 'session.created':
    case 'session.ended':
    case 'session.removed':
    case 'session.revoked': {
      const activity = event.data.latest_activity
      return recordAccessEvent(providerEventId, {
        clerkUserId: event.data.user_id,
        clerkSessionId: event.data.id,
        eventType: mapClerkEventType(event.type) as CustomerAccessEventType,
        eventTimestamp: new Date(event.data.updated_at ?? event.data.created_at ?? Date.now()),
        deviceType: activity?.device_type ?? null,
        browserName: activity?.browser_name ?? null,
        browserVersion: activity?.browser_version ?? null,
        ipAddress: activity?.ip_address ?? null,
        city: activity?.city ?? null,
        country: activity?.country ?? null,
        emailAddress: event.data.user ? primaryEmail(event.data.user) : null,
        outcome: event.data.status ?? null,
      })
    }
    case 'email.created': {
      return recordAccessEvent(providerEventId, {
        clerkUserId: event.data.user_id ?? null,
        clerkSessionId: null,
        eventType: 'EMAIL_CREATED',
        eventTimestamp: receivedHttpTimestamp,
        emailAddress: event.data.to_email_address ?? null,
        outcome: event.data.status ?? null,
      })
    }
    default:
      // Organization/role/permission/billing/waitlist events — this app
      // doesn't use Clerk Organizations, nothing to record.
      return 'skipped'
  }
}
