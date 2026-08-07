import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { listInventoryOverview } from '@/lib/adminInventory'

function isAdmin(userId: string | null) {
  return userId === process.env.ADMIN_CLERK_USER_ID
}

export async function GET() {
  const { userId } = await auth()
  if (!isAdmin(userId)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const rows = await listInventoryOverview()
  return NextResponse.json(rows)
}
