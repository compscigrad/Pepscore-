// Human "time waiting" formatting — e.g. "23 minutes", "2 hours", "1 day".
// Shared by the notification bell and the Awaiting Fulfillment queue, both
// of which need the exact same "how long has this been sitting" phrasing.
// Computed fresh from a timestamp on each render/request — never a stored,
// ticking value.
export function formatTimeElapsed(since: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - since.getTime()) / 1000))

  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
