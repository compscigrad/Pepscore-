// Shared shell for every /admin/* route -- the one shared AdminNav
// (2026-08-12 admin IA consolidation), so every admin section is
// reachable from anywhere instead of only through whichever page happened
// to link to it. AdminNav itself renders the notification bell inside its
// own row (2026-08-19 fix -- was previously an independently `fixed`
// element here that visually collided with the nav's own right-aligned
// link). Auth stays per-page (each admin page already redirects
// non-admins itself); AdminNav is link rendering only (no data fetch, no
// auth check of its own) and the bell's own API calls are independently
// admin-gated, so nothing here needs to duplicate that check.
import { AdminNav } from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  )
}
