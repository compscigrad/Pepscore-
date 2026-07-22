// Shared shell for every /admin/* route — currently just the notification
// bell, so it's present everywhere without each page wiring it in
// individually. Auth stays per-page (each admin page already redirects
// non-admins itself); the bell's own API calls are independently
// admin-gated, so nothing here needs to duplicate that check.
import { NotificationBell } from '@/components/admin/NotificationBell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationBell />
      {children}
    </>
  )
}
