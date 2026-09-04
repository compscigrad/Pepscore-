// Canonical viewer-timezone-aware timestamp presentation (2026-09-04
// timezone sprint). THE one place a moment-in-time gets converted from its
// UTC storage instant into something a human reads -- every other file
// that needs to show a real timestamp (not a pure calendar date with no
// time-of-day meaning) should import from here rather than calling
// toLocaleString()/toLocaleDateString() itself, which silently uses
// whichever timezone the CODE HAPPENS TO RUN IN (the browser's real
// timezone for a genuine client component, but UTC for anything rendered
// on Vercel's server -- a Server Component, an email/SMS generator, or a
// cron job) rather than the timezone that's actually appropriate to show.
//
// Root cause this fixes: an admin alert email generated server-side called
// `submittedAt.toLocaleString('en-US')` with no explicit timeZone -- Node
// on Vercel defaults to UTC, so a genuine 8:11 PM Eastern event rendered
// as "9/4/2026, 12:11:00 AM" in the email body. Never fixable by changing
// what's stored (this file changes nothing about persistence -- every
// DateTime column stays a UTC instant, exactly as it must).
//
// STORAGE vs DISPLAY: storage is always the raw UTC instant (a JS Date, a
// Prisma DateTime, an ISO string with a Z suffix) -- never altered here.
// Display always requires an explicit IANA timezone, resolved by the
// caller:
//   - A genuine client component (rendered in the visitor's own browser)
//     should pass getBrowserTimeZone() -- the actual device timezone, so
//     the owner traveling from DC to California sees the correct local
//     time with zero server/database change (section T7).
//   - A server-rendered surface with no known per-viewer timezone (most
//     admin Server Components, all async email/SMS generation, cron jobs)
//     falls back to PEPSCORE_BUSINESS_TIMEZONE -- never bare UTC, which is
//     nobody's real timezone and is specifically what produced this bug.
//   - If a customer's own IANA timezone is ever captured (not done today
//     -- see the sprint audit), pass that instead of the business fallback
//     for customer-facing sends.
export const PEPSCORE_BUSINESS_TIMEZONE = 'America/New_York'

function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value
}

// Client-only (reads a browser API) -- returns the actual device/browser
// IANA timezone, e.g. "America/Los_Angeles". Falls back to the business
// timezone if the runtime can't resolve one (extremely rare, very old
// browsers) rather than throwing.
export function getBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || PEPSCORE_BUSINESS_TIMEZONE
  } catch {
    return PEPSCORE_BUSINESS_TIMEZONE
  }
}

// "Sep 3, 2026, 8:11 PM EDT" -- the full moment-in-time presentation.
// timeZone defaults to the business fallback (safe for server rendering);
// pass getBrowserTimeZone() from a client component for a real viewer-local
// read.
export function formatDateTimeForViewer(value: Date | string, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(toDate(value))
}

// "Sep 3, 2026" -- the calendar date a moment-in-time falls on FOR THE
// GIVEN TIMEZONE. This is the one that actually crosses the date boundary
// the owner's report named (12:11 AM UTC is genuinely Sep 3 in every US
// timezone) -- never pass 'UTC' here for a real moment-in-time field
// (createdAt, paidAt, issuedAt, ...). A genuinely timezone-irrelevant
// calendar-only field (e.g. a ship date the admin picked with no time-of-
// day meaning) should NOT go through this function at all -- format it as
// a plain calendar date with no timezone conversion, since there is no
// "instant" to convert.
export function formatDateForViewer(value: Date | string, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(toDate(value))
}

// "8:11 PM EDT" -- time-of-day only, when the date is shown separately or
// is already obvious from context.
export function formatTimeForViewer(value: Date | string, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(toDate(value))
}

// The calendar date (1-31) a UTC instant falls on in the given timezone --
// the exact primitive the birthday-issuance day check needs (section T16):
// "today" for issuance purposes must be the business's calendar day, not
// whatever UTC happens to read at the moment the cron fires.
export function dayInTimeZone(value: Date, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).formatToParts(value)
  return Number(parts.find((p) => p.type === 'day')?.value)
}

export function monthInTimeZone(value: Date, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric' }).formatToParts(value)
  return Number(parts.find((p) => p.type === 'month')?.value)
}

export function yearInTimeZone(value: Date, timeZone: string = PEPSCORE_BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).formatToParts(value)
  return Number(parts.find((p) => p.type === 'year')?.value)
}
