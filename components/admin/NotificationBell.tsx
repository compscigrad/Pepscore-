'use client'
// Admin notification bell — polls for unread notifications every ~20s
// (no websocket/pub-sub infra in this project, see docs/Decisions.md),
// shows an unread badge, and lets the admin jump straight to the draft
// invoice a submission created. Rendered globally via app/admin/layout.tsx
// so it's present on every admin page without each page wiring it in.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatTimeElapsed } from '@/lib/formatTimeElapsed'

interface NotificationItem {
  id: string
  type: string
  invoiceId: string | null
  isNewCustomer: boolean
  possibleDuplicateOf: string | null
  read: boolean
  createdAt: string
  customer: { firstName: string; lastName: string } | null
  invoice: { invoiceNumber: string } | null
}

const POLL_INTERVAL_MS = 20_000

export function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?unreadOnly=true')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
    } catch {
      // Silent — a missed poll just tries again next interval.
    }
  }, [])

  useEffect(() => {
    const initial = setTimeout(fetchUnread, 0)
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [fetchUnread])

  async function handleOpenNotification(notification: NotificationItem) {
    try {
      await fetch(`/api/admin/notifications/${notification.id}`, { method: 'PATCH' })
    } catch {
      // Navigation still proceeds even if the mark-read call fails.
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
    setOpen(false)
    if (notification.invoiceId) router.push(`/admin/invoices/${notification.invoiceId}`)
  }

  async function handleMarkAllRead() {
    try {
      await fetch('/api/admin/notifications/mark-all-read', { method: 'PATCH' })
    } catch {
      // Best-effort — next poll will reconcile either way.
    }
    setNotifications([])
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-11 h-11 rounded-full bg-black border border-gold/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-center hover:border-gold/40 transition-colors"
        aria-label="Notifications"
      >
        <span className="text-gold text-lg">🔔</span>
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[10px] font-heading font-bold flex items-center justify-center">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[#0a0a0a] rounded-[18px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden border border-gold/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="font-heading text-[13px] font-bold text-white">Notifications</p>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-white/50 hover:text-gold transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-white/50">No unread notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpenNotification(n)}
                  className="w-full text-left px-4 py-3 border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-heading text-[13px] font-bold text-white">
                      {n.customer ? `${n.customer.firstName} ${n.customer.lastName}` : 'Unknown customer'}
                    </p>
                    <span
                      className={`text-[10px] font-heading font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full ${
                        n.isNewCustomer ? 'bg-gold/15 text-gold' : 'bg-white/5 text-white/50'
                      }`}
                    >
                      {n.isNewCustomer ? 'New' : 'Existing'}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/50">
                    {n.invoice ? `Draft ${n.invoice.invoiceNumber}` : 'Draft invoice'} · {formatTimeElapsed(new Date(n.createdAt))} ago
                  </p>
                  {n.possibleDuplicateOf && (
                    <p className="text-[11px] text-amber-400 mt-1">⚠ Possible duplicate customer</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
