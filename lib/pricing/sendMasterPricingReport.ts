// Sends the finalized master pricing report to admin@pepscorelab.com.
// NEVER called automatically -- this is a prepared, ready-to-run workflow,
// invoked only once the owner has explicitly reviewed and approved the
// pricing revision pass (2026-08-12) in docs/PendingOwnerActions.md.
// Reuses the standing "no real bulk/business-communication send without
// explicit approval" discipline this project has followed all session.
import { readFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { sendCategorizedEmail } from '@/lib/notifications/log'
import { ADMIN_EMAIL } from '@/lib/resend'
import { adminMasterPricingReportSubject, buildAdminMasterPricingReportHtml } from '@/emails/AdminMasterPricingReport'

const RETATRUTIDE_RATIO = 0.705
const CSV_PATH = 'docs/MasterPricingList-2026-08-12.csv'

export async function sendMasterPricingReport(): Promise<{ sent: boolean; failureReason: string | null }> {
  const products = await prisma.product.findMany({
    where: { pricingStatus: 'ACTIVE' },
    select: { name: true, size: true, activeStandardCasePrice: true, activeProCasePrice: true },
  })
  const reta = products.find((p) => p.name === 'Retatrutide' && p.size === '60mg')

  const csvBuffer = Buffer.from(readFileSync(CSV_PATH, 'utf-8'), 'utf-8')

  const html = buildAdminMasterPricingReportHtml({
    generatedAt: new Date(),
    totalActiveProducts: products.length,
    changedCount: products.filter((p) => p.activeStandardCasePrice != null).length,
    retatrutideStandard: reta?.activeStandardCasePrice ?? 0,
    retatrutideSpa: reta?.activeProCasePrice ?? 0,
    retatrutideRatio: RETATRUTIDE_RATIO,
    topChanges: [], // the full diff lives in the attached CSV; email body is a summary only
  })

  const result = await sendCategorizedEmail(
    {
      category: 'ADMIN_PRICING_REPORT',
      to: ADMIN_EMAIL,
      subject: adminMasterPricingReportSubject(),
      html,
      attachments: [{ filename: 'MasterPricingList-2026-08-12.csv', content: csvBuffer }],
    },
    { actorType: 'MANUAL' }
  )

  return { sent: result.sent, failureReason: result.failureReason }
}
