// Shared Admin page-header standard (2026-08-19 header-consistency pass).
// Audit found two silently-drifted header treatments across app/admin/**:
// most pages used text-3xl/mb-8/subtitle-mt-1, a handful (Customers,
// Product Master, Inventory, Inventory detail, Reservations, Finance) had
// independently settled on text-2xl/mb-6/subtitle-mt-0.5 -- close enough to
// look like an oversight, different enough to make the title block visibly
// jump size/position when navigating between them. This component is now
// the one place that geometry lives; the title/subtitle/actions CONTENT
// still varies per page, the FRAME does not.
//
// The subtitle line is always rendered, even when empty, with a reserved
// min-height -- a page with no subtitle keeps the same header block height
// as one with a subtitle (no fake placeholder text, just reserved layout
// space), so content below the header starts at the same vertical position
// across every page regardless of which page has a subtitle.
import type { ReactNode } from 'react'

export interface AdminPageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  // Rendered inline next to the title (e.g. status badges on a detail page).
  badge?: ReactNode
  // Rendered right-aligned, opposite the title block (e.g. "+ New Invoice",
  // "← Admin Dashboard"). Wraps below the title block on narrow screens.
  actions?: ReactNode
}

export function AdminPageHeader({ title, subtitle, badge, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading text-3xl font-bold text-white">{title}</h1>
          {badge}
        </div>
        <p className="text-white/50 text-sm mt-1 min-h-[1.25rem]">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-6 flex-wrap">{actions}</div>}
    </div>
  )
}
