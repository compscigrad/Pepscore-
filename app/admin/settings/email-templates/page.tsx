// Settings > Email Templates — admin preview capability for every reusable
// notification email (Phase 3D roadmap item 4): representative sample data
// only, no real send, no real customer/invoice data ever touched. Groups
// every template from lib/admin/emailTemplatePreviews.ts by category, each
// rendered in a fully sandboxed iframe -- same "preview raw HTML safely"
// pattern components/invoices/CorrespondenceHistory.tsx already uses for
// viewing a real sent email's content.
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAllEmailTemplatePreviews } from '@/lib/admin/emailTemplatePreviews'

export default async function EmailTemplatesPreviewPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    redirect('/')
  }

  const previews = getAllEmailTemplatePreviews()
  const categories = [...new Set(previews.map((p) => p.category))]

  return (
    <main className="min-h-screen bg-black p-8">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Email Templates</h1>
            <p className="text-white/50 text-sm mt-1">
              Settings · Email Templates · Pepscore Lab — {previews.length} templates, sample data only, nothing is ever sent from here.
            </p>
          </div>
          <Link
            href="/admin/settings/invoices"
            className="font-heading text-[12px] font-bold tracking-[0.08em] uppercase text-white/50 hover:text-gold transition-colors"
          >
            ← Settings
          </Link>
        </div>

        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="font-heading text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 mb-3">{category}</h2>
              <div className="space-y-3">
                {previews
                  .filter((p) => p.category === category)
                  .map((p) => (
                    <details key={p.key} className="bg-white/[0.03] border border-gold/10 rounded-[18px] p-5">
                      <summary className="cursor-pointer flex items-center justify-between gap-3">
                        <span className="text-white font-medium text-sm">{p.label}</span>
                        <span className="text-white/40 text-xs shrink-0">{p.subject}</span>
                      </summary>
                      <iframe
                        title={`${p.label} preview`}
                        srcDoc={p.html}
                        className="mt-4 w-full h-[600px] rounded-lg border border-white/10 bg-white"
                        sandbox=""
                      />
                    </details>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
