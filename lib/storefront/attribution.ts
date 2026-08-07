// First-touch marketing attribution for the storefront lead-capture forms
// (Phase 2B item 7). Captured once per browser via localStorage and never
// overwritten by a later visit, so a lead capture always reflects how the
// visitor originally found the site (referrer/UTM/landing URL), not
// whatever page they happened to submit the form from. Best-effort only --
// a visitor in private browsing or with storage disabled still submits
// fine, just without attribution.
const STORAGE_KEY = 'ps_attribution_v1'

export interface AttributionData {
  landingUrl: string
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
}

export function captureAttributionOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(STORAGE_KEY)) return
    const params = new URLSearchParams(window.location.search)
    const data: AttributionData = {
      landingUrl: window.location.href,
      referrer: document.referrer || null,
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      utmTerm: params.get('utm_term'),
      utmContent: params.get('utm_content'),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage unavailable -- attribution is best-effort, never blocks the page.
  }
}

export function getAttribution(): AttributionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AttributionData) : null
  } catch {
    return null
  }
}
