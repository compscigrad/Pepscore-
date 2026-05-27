'use client'
// ── LandingFooter.tsx ────────────────────────────────────────────────────────
// Luxury footer with RUO disclaimer

import Image from 'next/image'

export default function LandingFooter() {
  return (
    <footer style={{
      background: '#000',
      color: '#fff',
      padding: '68px 24px 36px',
      textAlign: 'center',
      borderTop: '1px solid rgba(212,175,55,0.12)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <Image
          src="/images/logo.png"
          alt="Pepscore Labs"
          width={180}
          height={72}
          style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(212,175,55,0.3)) brightness(1.05)' }}
        />
      </div>

      {/* Tagline */}
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.28em', color: 'rgba(212,175,55,0.6)', textTransform: 'uppercase', marginBottom: '10px' }}>
        Science &nbsp;·&nbsp; Precision &nbsp;·&nbsp; Performance
      </p>
      <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', marginBottom: '40px', fontWeight: 300, maxWidth: '400px', margin: '0 auto 40px', lineHeight: 1.65 }}>
        Precision peptide packaging solutions. Launching Fall 2026.
      </p>

      {/* Gold divider */}
      <div style={{ width: '60px', height: '1px', background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', margin: '0 auto 40px' }} />

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
        {[
          { label: 'Join Waitlist', href: '#inquiry' },
          { label: 'Capabilities', href: '#capabilities' },
          { label: '202.425.3161', href: 'tel:2024253161' },
          { label: 'pepscorelabs.com', href: 'https://pepscorelabs.com' },
        ].map(l => (
          <a
            key={l.label}
            href={l.href}
            style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '13px', transition: 'color 0.2s', letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.target as HTMLAnchorElement).style.color = '#D4AF37'}
            onMouseLeave={e => (e.target as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.35)'}
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* Copyright */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>
          © 2025 Pepscore Labs. All rights reserved.
        </p>
        {/* ── IMPORTANT: RUO Disclaimer ────────────────────────────────────── */}
        <p style={{
          fontSize: '10px',
          color: 'rgba(255,255,255,0.15)',
          maxWidth: '600px',
          margin: '0 auto',
          lineHeight: 1.7,
          letterSpacing: '0.02em',
        }}>
          Research Use Only (RUO) | Not for human consumption or diagnostic or therapeutic use.
          All products are intended for laboratory and research purposes only.
          Pepscore Labs assumes no liability for misuse or off-label application.
        </p>
      </div>
    </footer>
  )
}
