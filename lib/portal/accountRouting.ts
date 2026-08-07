// Pure routing decision for /account, extracted so the exact bug this fixes
// (an admin session silently bounced to /admin even when the visitor
// explicitly clicked "Customer Portal") has a unit-testable seam, not just
// end-to-end Clerk behavior no test suite here can exercise directly.
//
// Root cause: /account previously redirected to /admin whenever the signed-
// in Clerk user was the admin, with no way to distinguish "stale admin
// bookmark" (the case this was built for) from "admin explicitly clicked
// Customer Portal" (which must never bounce to /admin — see
// docs -- portal intent is determined by the button clicked, not by the
// role attached to the current session). customerIntent is the signal that
// makes that distinction: set only when the landing page's Customer Portal
// button was the actual entry point (redirect_url=/account?portal=customer),
// never inferred from session state.
export function shouldRedirectAdminToAdminDashboard(isAdmin: boolean, customerIntent: boolean): boolean {
  return isAdmin && !customerIntent
}

// True when an admin session landed on /account WITH explicit customer
// intent -- the case that must show a clear "you're signed in as admin"
// message instead of either silently redirecting to /admin or running
// customer-identity resolution against the admin's own Clerk user.
export function isAdminViewingCustomerPortal(isAdmin: boolean, customerIntent: boolean): boolean {
  return isAdmin && customerIntent
}
