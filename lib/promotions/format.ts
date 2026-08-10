// Shared discount-value formatting for Promotion Campaigns -- used by both
// admin UI (components/admin/PromotionCampaignManager.tsx) and every
// customer-facing surface (storefront banner/modal, discount email) so a
// fixed-dollar campaign never gets mangled into percent-shaped copy or
// vice versa. The whole point of generalizing FIRST10 into a campaign
// system is that neither side hardcodes "%".
import type { PromotionType } from '@prisma/client'

function formatValue(type: PromotionType, value: number): string {
  return type === 'PERCENTAGE' ? `${value}%` : `$${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`
}

export function formatDiscountLabel(type: PromotionType, value: number): string {
  return `${formatValue(type, value)} off`
}
