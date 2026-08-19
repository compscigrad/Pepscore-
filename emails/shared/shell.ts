// Centralized branded email shell for every customer-facing PepScore Lab
// email -- header (wordmark + gold accent) -> content -> footer. Content/
// business logic for each email stays in its own file; this module only
// owns presentation, so migrating a template onto it must never change
// what it says or when it sends (see docs/Decisions.md for the migration
// record).
//
// Every token below was measured directly from the live storefront via JS
// inspection, not guessed -- the same "measure the real site" discipline
// established in docs/Decisions.md #10's original dark-theme migration:
//   - CTA gradient: getComputedStyle() on the live "Shop All Products"
//     button returned linear-gradient(to right bottom, rgb(212,175,55),
//     rgb(232,200,74)) exactly -- #D4AF37 -> #E8C84A.
//   - Dark surfaces: a scan of large (>300px) elements on the live
//     homepage found rgb(0,0,0) and rgb(13,13,13) as the two dominant
//     backgrounds -- #000000 and #0D0D0D.
// This is deliberately the *customer-facing* gold (#D4AF37), distinct from
// the more muted Tailwind `gold` token (#C49A1A) used in the separate
// admin/invoice-builder dark theme (Decision #10) -- two intentional
// systems for two different audiences, not drift to reconcile.
export const EMAIL_COLORS = {
  bodyBg: '#050505', // outer email-client background, near-black
  contentBg: '#0d0d0d', // primary card background -- matches the live storefront's #0D0D0D panels
  panelBg: '#161616', // elevated/secondary panel, one step lighter for layered depth (not flat black-on-black)
  headerBg: '#000000', // header/footer band -- matches the live storefront's pure-black surfaces
  border: 'rgba(212,175,55,0.15)',
  borderStrong: 'rgba(212,175,55,0.35)',
  gold: '#D4AF37',
  goldLight: '#E8C84A',
  goldGradient: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.75)',
  textMuted: 'rgba(255,255,255,0.5)',
  textFooter: 'rgba(255,255,255,0.4)',
} as const

// The approved PepScore Lab "P" mark, served as a stable, publicly reachable
// PNG (public/images/email-logo-mark.png) -- an email-safe derivative of the
// same P monogram used on invoices (public/images/invoice-logo.jpeg):
// cropped to isolate just the icon and given real alpha transparency (the
// source has none), with the artwork itself -- proportions, gold gradient,
// design -- left completely unaltered. Reuses the same NEXT_PUBLIC_APP_URL
// fallback already established in app/sitemap.ts/app/robots.ts/
// lib/storefront/structuredData.ts, since email images must be an absolute,
// non-expiring URL (no local filesystem paths, no signed/expiring links).
const EMAIL_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepscore-compscigrads-projects.vercel.app'
export const EMAIL_LOGO_MARK_URL = `${EMAIL_APP_URL}/images/email-logo-mark.png`

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailShellOptions {
  // Small uppercase label under the wordmark, e.g. "Invoice", "Account Setup".
  eyebrow?: string
  bodyHtml: string
  // e.g. "Questions about this invoice? Reply to this email or contact orders@pepscorelab.com."
  footerNote: string
  year?: number
  // 2026-08-19 lead-capture/conversion engine, section 7/25 -- set only by
  // genuinely marketing sends (see lib/notifications/routing.ts's
  // isMarketingCategory()); every transactional email omits this and gets
  // no unsubscribe link, since an unsubscribe must never appear to apply to
  // order/account correspondence it can't actually affect.
  unsubscribeUrl?: string
}

// Email-safe: no external fonts/CSS, everything inline. Every gradient
// declares a flat gold `background` first and the gradient second on the
// same style attribute -- clients that don't support `linear-gradient()`
// keep the last background declaration they understand (the flat color),
// clients that do support it use the gradient, since the second
// declaration wins when both are valid CSS on the same property.
export function buildEmailShell({ eyebrow, bodyHtml, footerNote, year = new Date().getFullYear(), unsubscribeUrl }: EmailShellOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Tells Gmail/Outlook/Apple Mail's dark-mode heuristics this template
       is already deliberately dark -- without this, some clients try to
       auto-invert colors on a dark-background email, which would corrupt
       both the header and the transparent-background logo below. -->
  <meta name="color-scheme" content="dark light" />
  <meta name="supported-color-schemes" content="dark light" />
  <title>Pepscore Lab</title>
</head>
<body style="font-family:Helvetica,Arial,sans-serif;background:${EMAIL_COLORS.bodyBg};color:${EMAIL_COLORS.textPrimary};margin:0;padding:24px 12px">
  <div style="max-width:600px;margin:0 auto;background:${EMAIL_COLORS.contentBg};border:1px solid ${EMAIL_COLORS.border};border-radius:16px;overflow:hidden">
    <div style="background:${EMAIL_COLORS.headerBg};padding:28px 36px;text-align:center">
      <img
        src="${EMAIL_LOGO_MARK_URL}"
        width="44"
        height="44"
        alt="Pepscore Lab"
        style="display:block;width:44px;height:44px;margin:0 auto 10px;border:0;outline:none;text-decoration:none"
      />
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.01em">
        <span style="color:#ffffff">Pepscore</span><span style="color:${EMAIL_COLORS.gold}"> Lab</span>
      </div>
      ${eyebrow ? `<p style="margin:8px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${EMAIL_COLORS.textMuted}">${escapeHtml(eyebrow)}</p>` : ''}
      <div style="height:2px;width:56px;margin:16px auto 0;background:${EMAIL_COLORS.gold};background:linear-gradient(90deg, ${EMAIL_COLORS.gold}, ${EMAIL_COLORS.goldLight})"></div>
    </div>
    <div style="padding:32px 36px">
      ${bodyHtml}
    </div>
    <div style="background:${EMAIL_COLORS.headerBg};padding:20px 36px;border-top:1px solid ${EMAIL_COLORS.border}">
      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${EMAIL_COLORS.textMuted}">${footerNote}</p>
      ${unsubscribeUrl ? `<p style="margin:0 0 6px;font-size:11px;color:${EMAIL_COLORS.textFooter}"><a href="${unsubscribeUrl}" style="color:${EMAIL_COLORS.textFooter};text-decoration:underline">Unsubscribe from marketing emails</a></p>` : ''}
      <p style="margin:0;font-size:11px;color:${EMAIL_COLORS.textFooter}">© ${year} Pepscore Lab</p>
    </div>
  </div>
</body>
</html>`
}

// Consistent CTA button treatment across every email -- gold gradient,
// pill radius matching the live storefront's CTA shape (confirmed via
// direct inspection: border-radius: 9999px on the live "Shop All
// Products" button).
export function emailCta(href: string, label: string): string {
  return `<p style="text-align:center;margin:24px 0">
    <a href="${href}" style="display:inline-block;background:${EMAIL_COLORS.gold};background:${EMAIL_COLORS.goldGradient};color:#000000;font-weight:700;font-size:13px;letter-spacing:0.04em;text-decoration:none;padding:13px 30px;border-radius:999px">
      ${escapeHtml(label)}
    </a>
  </p>`
}

// Secondary/outline CTA for a less-emphasized second action alongside a
// primary emailCta (e.g. "View Invoice" next to "Choose Payment").
export function emailCtaOutline(href: string, label: string): string {
  return `<p style="text-align:center;margin:0 0 24px">
    <a href="${href}" style="display:inline-block;background:transparent;border:1px solid ${EMAIL_COLORS.borderStrong};color:${EMAIL_COLORS.gold};font-weight:700;font-size:13px;letter-spacing:0.04em;text-decoration:none;padding:12px 28px;border-radius:999px">
      ${escapeHtml(label)}
    </a>
  </p>`
}

// A dark, gold-bordered elevated panel for highlighting key info (a
// summary block, a code) -- one consistent "premium card" treatment
// instead of each template inventing its own box style.
export function emailPanel(innerHtml: string): string {
  return `<div style="background:${EMAIL_COLORS.panelBg};border:1px solid ${EMAIL_COLORS.border};border-radius:12px;padding:20px 24px;margin:24px 0;text-align:left">${innerHtml}</div>`
}
