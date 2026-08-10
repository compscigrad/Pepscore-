import { describe, it, expect } from 'vitest'
import { buildEmailShell, emailCta, emailCtaOutline, emailPanel, escapeHtml, EMAIL_COLORS, EMAIL_LOGO_MARK_URL } from './shell'

describe('buildEmailShell', () => {
  it('renders the current brand name "Pepscore Lab", not standalone "Pepscore"', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toContain('Pepscore')
    expect(html).toContain('Lab')
    // The wordmark specifically -- "Pepscore</span><span ...> Lab" -- not
    // just "Pepscore" appearing somewhere else incidentally.
    expect(html).toMatch(/Pepscore<\/span><span[^>]*> Lab/)
  })

  it('includes the gold brand accent color, not a flat/different yellow', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toContain(EMAIL_COLORS.gold)
    expect(html).toContain(EMAIL_COLORS.goldLight)
  })

  it('uses dark, layered backgrounds rather than a single flat black everywhere', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toContain(EMAIL_COLORS.contentBg)
    expect(html).toContain(EMAIL_COLORS.headerBg)
    expect(EMAIL_COLORS.contentBg).not.toBe(EMAIL_COLORS.headerBg) // genuinely two different tones
  })

  it('renders an eyebrow label when provided, and omits it cleanly when not', () => {
    const withEyebrow = buildEmailShell({ eyebrow: 'Invoice', bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(withEyebrow).toContain('Invoice')

    const withoutEyebrow = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(withoutEyebrow).not.toContain('undefined')
  })

  it('produces well-formed, non-empty HTML with a single html/body pair', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect((html.match(/<html>/g) ?? []).length).toBe(1)
    expect((html.match(/<\/html>/g) ?? []).length).toBe(1)
    expect((html.match(/<body/g) ?? []).length).toBe(1)
  })

  it('includes the current year in the footer copyright line', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note', year: 2026 })
    expect(html).toContain('© 2026 Pepscore Lab')
  })

  it('the footer note (critical transactional content) survives even if a caller passes plain text with no markup', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'Contact orders@pepscorelab.com with questions.' })
    expect(html).toContain('Contact orders@pepscorelab.com with questions.')
  })

  it('includes the PepScore Lab P logo mark as an absolute, non-local, non-expiring HTTPS URL', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toContain(`src="${EMAIL_LOGO_MARK_URL}"`)
    expect(EMAIL_LOGO_MARK_URL).toMatch(/^https:\/\//)
    // Never a local filesystem path or relative URL -- email clients fetch
    // this from their own servers, not the reader's machine.
    expect(EMAIL_LOGO_MARK_URL).not.toContain('localhost')
    expect(EMAIL_LOGO_MARK_URL).not.toMatch(/^(file:|\.\/|\/[^/])/)
  })

  it('gives the logo image accessible alt text, and keeps the text wordmark present so the brand is still identified with images blocked', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toMatch(/<img[^>]*alt="PepScore Lab"/)
    // The text wordmark below the image must still be there independent of
    // whether the image itself loads.
    expect(html).toMatch(/Pepscore<\/span><span[^>]*> Lab/)
  })

  it('constrains the logo to fixed, reasonable dimensions rather than letting it render oversized or stretched', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    const match = html.match(/<img[^>]*width="(\d+)"[^>]*height="(\d+)"/)
    expect(match).not.toBeNull()
    const [, width, height] = match!
    expect(Number(width)).toBe(Number(height)) // the source mark is square
    expect(Number(width)).toBeGreaterThan(16)
    expect(Number(width)).toBeLessThan(120)
  })

  it('declares dark/light color-scheme support so email clients do not auto-invert the deliberately dark template', () => {
    const html = buildEmailShell({ bodyHtml: '<p>hi</p>', footerNote: 'note' })
    expect(html).toContain('name="color-scheme" content="dark light"')
    expect(html).toContain('name="supported-color-schemes" content="dark light"')
  })
})

describe('emailCta / emailCtaOutline', () => {
  it('escapes the label so untrusted-looking text can never break out of the anchor markup', () => {
    const html = emailCta('https://example.com', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('embeds the href directly so the link actually points where the caller intended', () => {
    const html = emailCta('https://pepscorelab.com/account', 'Go to My Account')
    expect(html).toContain('href="https://pepscorelab.com/account"')
    expect(html).toContain('Go to My Account')
  })

  it('the outline variant is visually distinct (no filled gold background) from the primary CTA', () => {
    const primary = emailCta('https://example.com', 'Primary')
    const outline = emailCtaOutline('https://example.com', 'Secondary')
    expect(primary).toContain(EMAIL_COLORS.goldGradient)
    expect(outline).not.toContain(EMAIL_COLORS.goldGradient)
  })
})

describe('emailPanel', () => {
  it('wraps arbitrary inner HTML in the elevated panel treatment', () => {
    const html = emailPanel('<p>Total: $100</p>')
    expect(html).toContain('Total: $100')
    expect(html).toContain(EMAIL_COLORS.panelBg)
  })
})

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x">& 'quote'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp; &#39;quote&#39;&lt;/a&gt;')
  })

  it('a customer name containing HTML-significant characters cannot inject markup into the email', () => {
    const dangerous = `Mike<img src=x onerror=alert(1)>`
    const escaped = escapeHtml(dangerous)
    expect(escaped).not.toContain('<img')
    expect(escaped).toContain('&lt;img')
  })
})
