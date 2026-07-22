// Terminal states for an invalid/expired/invalidated/attempt-limited link -
// rendered by the server page directly, no interactivity needed.
const REASON_COPY: Record<string, { heading: string; body: string }> = {
  NOT_FOUND: {
    heading: 'Link not found',
    body: "This link doesn't match anything on file. Double-check the link, or reach out to us for a new one.",
  },
  EXPIRED: {
    heading: 'This link has expired',
    body: 'For your security, intake links expire after a while. Please reach out to us and we can send a fresh one.',
  },
  INVALIDATED: {
    heading: 'This link is no longer active',
    body: 'This link has been deactivated. Please reach out to us and we can send a new one.',
  },
  TOO_MANY_ATTEMPTS: {
    heading: 'Too many attempts',
    body: "This link has reached its attempt limit for your security. Please reach out to us and we'll send a new one.",
  },
}

export function IntakeStatusMessage({ reason }: { reason: string }) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.NOT_FOUND

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE</h1>
        <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">Customer Information</p>
        <h2 className="text-lg font-bold text-white mb-3">{copy.heading}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{copy.body}</p>
      </div>
    </main>
  )
}
