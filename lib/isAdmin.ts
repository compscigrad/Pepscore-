// The one place "is this Clerk user the admin" is decided — a single
// hardcoded ADMIN_CLERK_USER_ID comparison, same check every admin API
// route already inlines individually. Centralized here so the two places
// that need to reason about admin identity *before* any customer-portal
// logic runs (app/account/page.tsx's admin short-circuit, app/admin/
// page.tsx's own check) share one definition instead of two copies that
// could drift.
export function isAdminClerkUser(userId: string | null | undefined): boolean {
  return Boolean(userId) && userId === process.env.ADMIN_CLERK_USER_ID
}
