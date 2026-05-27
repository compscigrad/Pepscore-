'use client'
// ── LandingHero.tsx ─────────────────────────────────────────────────────────
// Hero section — luxury black + gold + molecular aesthetic

import Image from 'next/image'

const MOLECULE_SVG = (
  <svg
    viewBox="0 0 520 520"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', height: '100%', opacity: 0.18 }}
    aria-hidden
  >
    {/* Molecular structure */}
    <circle cx="260" cy="260" r="40" stroke="#D4AF37" strokeWidth="2" />
    <circle cx="140" cy="160" r="28" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="380" cy="160" r="28" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="140" cy="360" r="28" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="380" cy="360" r="28" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="260" cy="100" r="22" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="260" cy="420" r="22" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="80"  cy="260" r="22" stroke="#D4AF37" strokeWidth="1.5" />
    <circle cx="440" cy="260" r="22" stroke="#D4AF37" strokeWidth="1.5" />
    {/* Bonds */}
    <line x1="225" y1="235" x2="165" y2="185" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="295" y1="235" x2="355" y2="185" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="225" y1="285" x2="165" y2="335" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="295" y1="285" x2="355" y2="335" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="260" y1="220" x2="260" y2="122" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="260" y1="300" x2="260" y2="398" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="220" y1="260" x2="102" y2="260" stroke="#D4AF37" strokeWidth="1.5" />
    <line x1="300" y1="260" x2="418" y2="260" stroke="#D4AF37" strokeWidth="1.5" />
    {/* Outer rings */}
    <circle cx="260" cy="260" r="120" stroke="#D4AF37" strokeWidth="0.75" strokeDasharray="4 8" />
    <circle cx="260" cy="260" r="200" stroke="#D4AF37" strokeWidth="0.5" strokeDasharray="2 12" />
  </svg>
)

export default function LandingHero() {
  return (
    <section style={{
      background: 'linear-gradient(160deg, #0A0A0A 0%, #111108 50%, #0D0C00 100%)',
      minHeight: '96vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '100px 24px 80px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow layers */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {/* Gold radial glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px', height: '700px',
          background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 65%)',
        }} />
        {/* Top highlight */}
        <div style={{
          position: 'absolute', top: '-100px', left: '50%',
          transform: 'translateX(-50%)',
          width: '600px', height: '400px',
          background: 'radial-gradient(ellipse, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }} />
        {/* Molecular decoration — right */}
        <div style={{ position: 'absolute', right: '-120px', top: '50%', transform: 'translateY(-50%)', width: '520px', height: '520px' }}>
          {MOLECULE_SVG}
        </div>
        {/* Molecular decoration — left (mirror) */}
        <div style={{ position: 'absolute', left: '-120px', top: '50%', transform: 'translateY(-50%) scaleX(-1)', width: '400px', height: '400px' }}>
          {MOLECULE_SVG}
        </div>
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Launching badge */}
      <div style={{
        position: 'absolute', top: '28px', right: '32px',
        background: 'rgba(212,175,55,0.1)',
        border: '1px solid rgba(212,175,55,0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: '50px',
        padding: '7px 18px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: '#D4AF37',
        textTransform: 'uppercase',
        zIndex: 10,
      }}>
        🔬 Launching 2025
      </div>

      <div style={{ position: 'relative', zIndex: 10, maxWidth: '900px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <Image
            src="/images/logo.png"
            alt="Pepscore Labs"
            width={220}
            height={88}
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 32px rgba(212,175,55,0.4)) brightness(1.1)',
            }}
            priority
          />
        </div>

        {/* COA / Purity badge row */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
          {[
            { icon: '🏆', label: 'COA Certified' },
            { icon: '🧫', label: 'Sterile' },
            { icon: '⚗️', label: '99.9% Purity' },
            { icon: '📦', label: 'Wholesale & Retail' },
          ].map(b => (
            <div key={b.label} style={{
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '50px',
              padding: '7px 16px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#D4AF37',
              letterSpacing: '0.06em',
            }}>
              {b.icon} &nbsp; {b.label}
            </div>
          ))}
        </div>

        {/* Tagline */}
        <p style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.32em',
          color: 'rgba(212,175,55,0.7)',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}>
          Science &nbsp;·&nbsp; Precision &nbsp;·&nbsp; Performance
        </p>

        {/* H1 */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 800,
          lineHeight: 1.08,
          color: '#fff',
          marginBottom: '24px',
          letterSpacing: '-0.02em',
        }}>
          Peptide Solutions.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #C49A1A, #E8C84A, #D4AF37)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Elevated.
          </span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: 'clamp(15px, 2vw, 20px)',
          color: 'rgba(255,255,255,0.65)',
          marginBottom: '10px',
          fontWeight: 300,
          lineHeight: 1.6,
          maxWidth: '640px',
          margin: '0 auto 10px',
        }}>
          Wholesale &amp; Retail Packaging
        </p>
        <p style={{
          fontSize: 'clamp(14px, 1.8vw, 17px)',
          color: 'rgba(255,255,255,0.45)',
          marginBottom: '52px',
          fontWeight: 300,
          maxWidth: '560px',
          margin: '0 auto 52px',
          lineHeight: 1.65,
        }}>
          Premium-grade peptide solutions. Vials, kits, and bulk packaging systems for serious research suppliers and laboratories.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '60px' }}>
          <a
            href="#inquiry"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
              color: '#000',
              padding: '16px 36px',
              borderRadius: '50px',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(212,175,55,0.4)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Join the Waitlist →
          </a>
          <a
            href="#capabilities"
            style={{
              border: '1px solid rgba(212,175,55,0.4)',
              color: 'rgba(255,255,255,0.85)',
              padding: '16px 36px',
              borderRadius: '50px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'rgba(212,175,55,0.06)',
              backdropFilter: 'blur(8px)',
            }}
          >
            View Capabilities
          </a>
        </div>

        {/* Stat row */}
        <div style={{ display: 'flex', gap: '0', justifyContent: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(212,175,55,0.15)', paddingTop: '36px' }}>
          {[
            { value: '99.9%', label: 'Verified Purity' },
            { value: 'COA', label: 'Certified Analysis' },
            { value: 'Sterile', label: 'Manufacturing' },
            { value: 'Bulk', label: 'Pricing Available' },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '0 32px',
              borderRight: i < 3 ? '1px solid rgba(212,175,55,0.15)' : 'none',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: 'clamp(22px, 3vw, 30px)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '4px',
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
