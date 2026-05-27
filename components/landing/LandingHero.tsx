'use client'
// ── LandingHero.tsx ─────────────────────────────────────────────────────────
// Hero section — full-bleed launch image + luxury dark overlay + gold accents

import Image from 'next/image'

// ─── Responsive styles ────────────────────────────────────────────────────────
const HERO_STYLES = `
  .ps-hero-section {
    position: relative;
    min-height: 96vh;
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .ps-hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    z-index: 0;
  }
  .ps-hero-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(
      108deg,
      rgba(0,0,0,0.97) 0%,
      rgba(0,0,0,0.93) 28%,
      rgba(0,0,0,0.75) 55%,
      rgba(0,0,0,0.28) 80%,
      rgba(0,0,0,0.05) 100%
    );
  }
  .ps-hero-content {
    position: relative;
    z-index: 10;
    max-width: 1260px;
    width: 100%;
    margin: 0 auto;
    padding: 120px 64px 96px;
  }
  .ps-hero-inner {
    max-width: 620px;
  }
  .ps-badge-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 28px;
  }
  .ps-cta-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 52px;
  }
  .ps-stat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    border-top: 1px solid rgba(212,175,55,0.15);
    padding-top: 36px;
  }
  @media (max-width: 960px) {
    .ps-hero-overlay {
      background: linear-gradient(
        180deg,
        rgba(0,0,0,0.97) 0%,
        rgba(0,0,0,0.95) 50%,
        rgba(0,0,0,0.92) 100%
      ) !important;
    }
    .ps-hero-content {
      padding: 100px 22px 72px;
      text-align: center;
    }
    .ps-hero-inner {
      max-width: 100%;
    }
    .ps-badge-row {
      justify-content: center;
    }
    .ps-cta-row {
      justify-content: center;
    }
    .ps-stat-row {
      justify-content: center;
    }
  }
`

export default function LandingHero() {
  return (
    <>
      <style>{HERO_STYLES}</style>

      <section className="ps-hero-section">

        {/* ── Hero photograph — fills the entire section ────────────────────── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-launch.jpg"
          alt=""
          className="ps-hero-img"
          aria-hidden="true"
        />

        {/* ── Deep dark overlay — reveals image on the right on desktop ──────── */}
        <div className="ps-hero-overlay" />

        {/* ── Subtle gold haze on content side ─────────────────────────────── */}
        <div style={{
          position: 'absolute', top: '50%', left: '180px',
          transform: 'translate(-50%, -50%)',
          width: '640px', height: '640px',
          background: 'radial-gradient(ellipse, rgba(212,175,55,0.07) 0%, transparent 65%)',
          pointerEvents: 'none', zIndex: 2,
        }} />

        {/* ── Subtle molecular grid overlay ──────────────────────────────────── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
          backgroundImage: 'linear-gradient(rgba(212,175,55,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />

        {/* Launching badge — top right */}
        <div style={{
          position: 'absolute', top: '24px', right: '28px',
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(212,175,55,0.5)',
          backdropFilter: 'blur(12px)',
          borderRadius: '50px',
          padding: '7px 18px',
          fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.14em', color: '#D4AF37',
          textTransform: 'uppercase', zIndex: 20,
        }}>
          🔬 Launching 2025
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="ps-hero-content">
          <div className="ps-hero-inner">

            {/* Logo */}
            <div style={{ marginBottom: '28px' }}>
              <Image
                src="/images/logo.png"
                alt="Pepscore Labs"
                width={200}
                height={80}
                style={{
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 6px 24px rgba(212,175,55,0.45)) brightness(1.1)',
                }}
                priority
              />
            </div>

            {/* Feature badges */}
            <div className="ps-badge-row">
              {[
                { icon: '🏆', label: 'COA Certified' },
                { icon: '🧫', label: 'Sterile' },
                { icon: '⚗️', label: '99.9% Purity' },
                { icon: '📦', label: 'Wholesale & Retail' },
              ].map(b => (
                <div key={b.label} style={{
                  background: 'rgba(212,175,55,0.1)',
                  border: '1px solid rgba(212,175,55,0.35)',
                  borderRadius: '50px', padding: '7px 16px',
                  fontSize: '12px', fontWeight: 600,
                  color: '#D4AF37', letterSpacing: '0.06em',
                  backdropFilter: 'blur(8px)',
                }}>
                  {b.icon} &nbsp; {b.label}
                </div>
              ))}
            </div>

            {/* Tagline */}
            <p style={{
              fontSize: '12px', fontWeight: 700, letterSpacing: '0.32em',
              color: 'rgba(212,175,55,0.65)', textTransform: 'uppercase', marginBottom: '18px',
            }}>
              Science &nbsp;·&nbsp; Precision &nbsp;·&nbsp; Performance
            </p>

            {/* H1 */}
            <h1 style={{
              fontSize: 'clamp(34px, 5.5vw, 68px)',
              fontWeight: 800, lineHeight: 1.08, color: '#fff',
              marginBottom: '22px', letterSpacing: '-0.02em',
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
              fontSize: 'clamp(14px, 1.9vw, 19px)',
              color: 'rgba(255,255,255,0.65)', marginBottom: '8px',
              fontWeight: 400, lineHeight: 1.6,
            }}>
              Wholesale &amp; Retail Packaging
            </p>
            <p style={{
              fontSize: 'clamp(13px, 1.6vw, 17px)',
              color: 'rgba(255,255,255,0.45)', marginBottom: '44px',
              fontWeight: 300, lineHeight: 1.7, maxWidth: '520px',
            }}>
              Premium-grade peptide solutions. Vials, kits, and bulk packaging systems for serious research suppliers and laboratories.
            </p>

            {/* CTAs */}
            <div className="ps-cta-row">
              <a
                href="#inquiry"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                  color: '#000', padding: '16px 34px', borderRadius: '50px',
                  fontWeight: 700, fontSize: '14px', textDecoration: 'none',
                  boxShadow: '0 10px 32px rgba(212,175,55,0.45)',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                }}
              >
                Join the Waitlist →
              </a>
              <a
                href="#capabilities"
                style={{
                  border: '1px solid rgba(212,175,55,0.45)',
                  color: 'rgba(255,255,255,0.9)', padding: '16px 34px', borderRadius: '50px',
                  fontWeight: 600, fontSize: '14px', textDecoration: 'none',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  background: 'rgba(212,175,55,0.07)', backdropFilter: 'blur(8px)',
                }}
              >
                View Capabilities
              </a>
              <a
                href="tel:2024253161"
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.7)', padding: '16px 28px', borderRadius: '50px',
                  fontWeight: 600, fontSize: '14px', textDecoration: 'none',
                  background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)',
                  letterSpacing: '0.04em',
                }}
              >
                📞 202.425.3161
              </a>
            </div>

            {/* Stats row */}
            <div className="ps-stat-row">
              {[
                { value: '99.9%', label: 'Verified Purity' },
                { value: 'COA', label: 'Certified Analysis' },
                { value: 'Sterile', label: 'Manufacturing' },
                { value: 'Bulk', label: 'Pricing Available' },
              ].map((s, i) => (
                <div key={s.label} style={{
                  padding: '0 28px',
                  borderRight: i < 3 ? '1px solid rgba(212,175,55,0.15)' : 'none',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    fontSize: 'clamp(20px, 2.5vw, 28px)',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginBottom: '4px',
                  }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>
    </>
  )
}
