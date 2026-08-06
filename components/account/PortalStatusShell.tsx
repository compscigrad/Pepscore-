// Shared "nothing to show, here's why" full-page shell for the portal —
// same visual pattern as components/intake/IntakeStatusMessage.tsx, reused
// here since both are pre-portal-nav, branded, centered messaging states.
export function PortalStatusShell({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.03] border border-gold/10 rounded-[18px] p-8 text-center">
        <h1 className="font-heading text-2xl font-bold text-white mb-2">PEPSCORE</h1>
        <p className="text-gold text-xs uppercase tracking-[0.2em] mb-6">My Account</p>
        <h2 className="text-lg font-bold text-white mb-3">{heading}</h2>
        <p className="text-white/60 text-sm leading-relaxed">{body}</p>
      </div>
    </main>
  )
}
