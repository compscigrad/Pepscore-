// Public, unauthenticated customer intake page — the landing spot for a
// link generated via the "Request Customer Information" admin action
// (components/invoices/IntakeLinkSection.tsx). Calls validateIntakeLink()
// directly (a Server Component can safely import lib/intakeLinks.ts; only
// client components need the dependency-free lib/intakeLinkState.ts split).
import { validateIntakeLink } from '@/lib/intakeLinks'
import { IntakeForm } from '@/components/intake/IntakeForm'
import { IntakeStatusMessage } from '@/components/intake/IntakeStatusMessage'

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const validation = await validateIntakeLink(token)

  if (!validation.valid) {
    return <IntakeStatusMessage reason={validation.reason} />
  }

  return (
    <IntakeForm
      token={token}
      alreadySubmittedAt={validation.link.submittedAt ? validation.link.submittedAt.toISOString() : null}
    />
  )
}
