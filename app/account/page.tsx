// Customer portal dashboard — the landing page after sign-in. Every figure
// on this page comes from getPortalDashboardData(customer.id), scoped to
// the authenticated customer resolved server-side by getPortalAuthState();
// nothing here ever takes an id from the client.
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getPortalAuthState, isSelfRegistrationEnabled } from '@/lib/portalAuth'
import { isAdminClerkUser } from '@/lib/isAdmin'
import { checkRateLimit } from '@/lib/rateLimit'
import { resolveSelfServiceIdentity } from '@/lib/portal/selfServiceResolve'
import { getPortalDashboardData } from '@/lib/portal/dashboard'
import { shouldRedirectAdminToAdminDashboard, isAdminViewingCustomerPortal } from '@/lib/portal/accountRouting'
import { formatMoney, formatDate } from '@/lib/invoice/format'
import { StatusBadge } from '@/components/invoices/StatusBadge'
import { PortalStatusShell } from '@/components/account/PortalStatusShell'
import { getCategoryLabel } from '@/lib/notifications/categoryLabels'

interface Props {
  searchParams: Promise<{ portal?: string }>
}

export default async function AccountPage({ searchParams }: Props) {
  const { userId } = await auth()
  const isAdmin = isAdminClerkUser(userId)
  // Set only by the landing page's "Customer Portal" button
  // (redirect_url=/account?portal=customer) -- the explicit signal that
  // this visit is a deliberate customer-intent click-through, never
  // inferred from session state. Portal intent is determined by the button
  // selected, not by the role attached to whatever Clerk session happens
  // to already exist.
  const customerIntent = (await searchParams).portal === 'customer'

  // A stale admin bookmark to /account (no customer intent) still bounces
  // straight to /admin instead of showing confusing customer messaging --
  // that's the original behavior this replaces, preserved for the one case
  // it was actually built for.
  if (shouldRedirectAdminToAdminDashboard(isAdmin, customerIntent)) redirect('/admin')

  // Explicit customer intent from an admin session: never silently reinterpret
  // this as an admin request, and never run customer-identity resolution
  // against the admin's own Clerk user (which would try to match/create a
  // Customer record for the admin's email) -- show a clear, honest state
  // instead. This is the exact fix for the production bug where clicking
  // Customer Portal while already signed in as admin landed on /admin.
  if (isAdminViewingCustomerPortal(isAdmin, customerIntent)) {
    return (
      <PortalStatusShell
        heading="You're signed in as the site admin"
        body="This browser session is signed in with the Pepscore Lab admin account, not a customer account. Sign out and sign back in with a customer account to view the Customer Portal."
      />
    )
  }

  const authState = await getPortalAuthState()

  if (authState.state === 'UNAUTHENTICATED') redirect('/sign-in')

  if (authState.state === 'NOT_LINKED') {
    const resolved = await tryResolveNotLinked()
    if (resolved === 'RESOLVED') redirect('/account') // re-evaluate fresh as AUTHORIZED
    if (resolved === 'NEEDS_REVIEW') {
      return (
        <PortalStatusShell
          heading="Setting up your account"
          // Deliberately identical wording regardless of *why* resolution
          // couldn't complete (multiple matching records vs. already claimed
          // by someone else) — see lib/portal/selfServiceResolve.ts's header
          // comment on enumeration-safety. Never hint at which case applies.
          body="We're finishing setting up your account and will follow up shortly. If you need immediate help, contact us."
        />
      )
    }
    return (
      <PortalStatusShell
        heading="No account found"
        body="We don't see a Pepscore Lab account linked to this login yet. Contact us and we'll get you set up."
      />
    )
  }
  if (authState.state === 'DISABLED') {
    return (
      <PortalStatusShell
        heading="Access disabled"
        body="Portal access for this account has been disabled. Contact us if you believe this is a mistake."
      />
    )
  }

  const { customer } = authState
  const data = await getPortalDashboardData(customer.id)

  return (
    <main className="px-4 py-8">
      <div className="max-w-[960px] mx-auto space-y-6">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.2em] mb-1">My Account</p>
          <h1 className="font-heading text-2xl font-bold text-white">Welcome, {customer.firstName}</h1>
        </div>

        {data.requiredActions.length > 0 ? (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4">
            <p className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-amber-300 mb-2">
              Action Needed
            </p>
            <ul className="space-y-1">
              {data.requiredActions.map((action, i) => (
                <li key={i} className="text-white/80 text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-[0.08em] mb-1">Outstanding Balance</p>
            <p className="font-heading text-2xl font-bold text-gold-light">{formatMoney(data.outstandingBalance)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <p className="text-white/40 text-xs uppercase tracking-[0.08em] mb-1">Account Credit Available</p>
            <p className="font-heading text-2xl font-bold text-white">
              {formatMoney(data.accountCredits.reduce((sum, c) => sum + c.remainingAmount, 0))}
            </p>
          </div>
        </div>

        {data.activeTracking.length > 0 ? (
          <Section title="Active Tracking">
            <div className="space-y-2">
              {data.activeTracking.map((t, i) => (
                <div key={i} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {t.carrier} — {t.trackingNumber}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">Invoice {t.invoiceNumber}</p>
                  </div>
                  <StatusBadge status={t.shippingStatus} variant="shipping" />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {data.backorderNotices.length > 0 ? (
          <Section title="Backordered Items">
            <div className="space-y-2">
              {data.backorderNotices.map((b, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white text-sm font-medium">{b.productName}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Invoice {b.invoiceNumber}
                    {b.expectedAvailableDate ? ` — expected ${formatDate(b.expectedAvailableDate)}` : ' — expected date to be confirmed'}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {data.pendingRefunds.length > 0 ? (
          <Section title="Pending Refunds">
            <div className="space-y-2">
              {data.pendingRefunds.map((r, i) => (
                <div key={i} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div>
                    <p className="text-white text-sm font-medium">{formatMoney(r.requestedAmount)} requested</p>
                    <p className="text-white/40 text-xs mt-0.5">Invoice {r.invoiceNumber}</p>
                  </div>
                  <StatusBadge status={r.status} variant="refund" />
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Recent Invoices">
          {data.recentInvoices.length === 0 ? (
            <p className="text-white/50 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentInvoices.map((inv) => (
                <div key={inv.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-heading font-bold text-white text-sm">{inv.invoiceNumber}</p>
                      <p className="text-white/40 text-xs mt-0.5">{formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={inv.status} variant="invoice" />
                      <span className="font-heading font-bold text-gold-light text-sm">
                        {inv.balanceDue > 0 ? `${formatMoney(inv.balanceDue)} due` : formatMoney(inv.total)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {data.recentCommunications.length > 0 ? (
          <Section title="Recent Communications">
            <div className="space-y-2">
              {data.recentCommunications.map((c) => (
                <div key={c.id} className="flex items-center justify-between flex-wrap gap-2 bg-white/[0.03] border border-white/10 rounded-lg p-3">
                  <p className="text-white/80 text-sm">{c.subject ?? getCategoryLabel(c.category)}</p>
                  <p className="text-white/40 text-xs">{formatDate(c.sentAt)}</p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  )
}

// Attempts self-service resolution for a signed-in Clerk user who isn't yet
// linked to a Customer — covers both "just signed up" and "signed in but
// never resolved" (self-heals a stuck visitor on their next page load)
// since both flows land here. Returns 'SKIPPED' unchanged (falls through to
// the plain "No account found" message) whenever resolution can't safely
// run: the feature flag is off, there's no verified email yet, or — the one
// hard exclusion — this is the admin's own Clerk identity, which must never
// be treated as a self-registration candidate.
type ResolveOutcome = 'RESOLVED' | 'NEEDS_REVIEW' | 'SKIPPED'

async function tryResolveNotLinked(): Promise<ResolveOutcome> {
  if (!isSelfRegistrationEnabled()) return 'SKIPPED'

  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return 'SKIPPED'
  if (clerkUserId === process.env.ADMIN_CLERK_USER_ID) return 'SKIPPED'

  // Every /account visit for a not-yet-linked user re-runs matching against
  // the Customer table -- a legitimate visitor rarely reloads more than a
  // couple of times, but nothing otherwise stops rapid repeated requests
  // from probing outcomes. Keyed per Clerk user (already authenticated),
  // not per IP -- this is behind auth, not a public endpoint. Failing the
  // rate limit returns 'SKIPPED', identical to every other unresolvable
  // case, so hitting the limit is never itself a distinguishable signal.
  const rateLimit = checkRateLimit(`self-service-resolve:${clerkUserId}`, 10, 5 * 60_000)
  if (!rateLimit.allowed) return 'SKIPPED'

  const clerkUser = await currentUser()
  const primaryEmail = clerkUser?.primaryEmailAddress
  if (!primaryEmail || primaryEmail.verification?.status !== 'verified') return 'SKIPPED'

  const result = await resolveSelfServiceIdentity({
    clerkUserId,
    clerkVerifiedEmail: primaryEmail.emailAddress,
    clerkFirstName: clerkUser.firstName,
    clerkLastName: clerkUser.lastName,
  })

  if (result.outcome === 'NEEDS_REVIEW') return 'NEEDS_REVIEW'
  return 'RESOLVED' // CLAIMED_EXISTING | REGISTERED_NEW | ALREADY_LINKED
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-heading text-[11px] font-bold tracking-[0.08em] uppercase text-white/50 mb-3">{title}</h2>
      {children}
    </div>
  )
}
