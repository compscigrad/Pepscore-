// Shared shell for every /account/* route. The nav only renders once the
// session resolves to an AUTHORIZED linked customer — an unauthenticated
// visitor, a not-yet-linked signed-in user, a disabled account, and the
// claim page itself all render their own full-page state with no portal
// chrome around it (there is nothing to navigate to yet).
//
// This is UI-only. It is never a substitute for each page's own
// getPortalCustomer() ownership check — every page/route still resolves
// and scopes its own data independently, the same "never trust a single
// choke point alone" posture the admin surface already follows.
import { getPortalAuthState } from '@/lib/portalAuth'
import { PortalNav } from '@/components/account/PortalNav'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const authState = await getPortalAuthState()

  if (authState.state !== 'AUTHORIZED') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-dark">
      <PortalNav />
      {children}
    </div>
  )
}
