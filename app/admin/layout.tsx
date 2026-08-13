// Shared shell for every /admin/* route -- the notification bell plus
// (2026-08-12 admin IA consolidation) the one shared AdminNav, so every
// admin section is reachable from anywhere instead of only through
// whichever page happened to link to it. Auth stays per-page (each admin
// page already redirects non-admins itself); AdminNav is link rendering
// only (no data fetch, no auth check of its own) and the bell's own API
// calls are independently admin-gated, so nothing here needs to duplicate
// that check.
import { NotificationBell } from '@/components/admin/NotificationBell'
import { AdminNav } from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav />
      <NotificationBell />
      {children}
    </>
  )
}
