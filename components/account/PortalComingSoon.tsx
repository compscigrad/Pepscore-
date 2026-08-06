// Placeholder for nav destinations this PR wires up but doesn't build out
// yet (real content lands in the next PRs in this sprint) — never a dead
// link, always an honest, still-authenticated state.
export function PortalComingSoon({ title }: { title: string }) {
  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-heading text-2xl font-bold text-white mb-3">{title}</h1>
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/50 text-sm">This section is coming soon.</p>
        </div>
      </div>
    </main>
  )
}
