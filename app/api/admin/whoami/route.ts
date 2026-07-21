// GET /api/admin/whoami — tells the client whether the signed-in user is the
// admin, without ever exposing ADMIN_CLERK_USER_ID itself to the browser.
// Used by ClerkAuthButtons to decide whether to show the "Admin" nav link.
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  const isAdmin = !!userId && userId === process.env.ADMIN_CLERK_USER_ID
  return NextResponse.json({ isAdmin })
}
