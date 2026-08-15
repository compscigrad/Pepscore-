// GET /api/admin/whoami — tells the client whether the signed-in user is the
// admin, without ever exposing ADMIN_CLERK_USER_ID itself to the browser.
// Used by ClerkAuthButtons to decide whether to show the "Admin" nav link.
import { NextResponse } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/auth/rbac'

export async function GET() {
  return NextResponse.json({ isAdmin: await isCurrentUserAdmin() })
}
