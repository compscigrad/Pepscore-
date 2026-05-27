// ── LandingContact.tsx ───────────────────────────────────────────────────────
// Contact card + QR code section

import Image from 'next/image'

export default function LandingContact() {
  return (
    <section style={{
      padding: '88px 24px 104px',
      background: 'linear-gradient(160deg, #0D0C00 0%, #100F00 50%, #0A0800 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Gold glow bg */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '800px', height: '600px',
        background: 'radial-gradient(ellipse, rgba(212,175,55,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      {/* Top line */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '200px', height: '1px',
        background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
      }} />

      <div style={{ maxWidth: '960px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', marginBottom: '14px' }}>
            Connect Directly
          </p>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 42px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Ready to Discuss Your Needs?
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px', alignItems: 'center' }}>

          {/* Contact Card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '28px',
            padding: '44px 36px',
            border: '1px solid rgba(212,175,55,0.25)',
            boxShadow: '0 24px 72px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
          }}>
            {/* Logo */}
            <div style={{ marginBottom: '28px' }}>
              <Image
                src="/images/logo.png"
                alt="Pepscore Labs"
                width={160}
                height={64}
                style={{ objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(212,175,55,0.3)) brightness(1.05)' }}
              />
            </div>

            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '24px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
              Pepscore Labs &nbsp;|&nbsp; DC Metro Area
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <a href="tel:2024253161" style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: 500,
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                  borderRadius: '12px', width: '46px', height: '46px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0, boxShadow: '0 4px 16px rgba(212,175,55,0.35)',
                }}>📞</span>
                202.425.3161
              </a>
              <a href="https://pepscorelabs.com" style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: 500,
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                  borderRadius: '12px', width: '46px', height: '46px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', flexShrink: 0, boxShadow: '0 4px 16px rgba(212,175,55,0.35)',
                }}>🌐</span>
                pepscorelabs.com
              </a>
            </div>

            {/* Action button */}
            <a
              href="#inquiry"
              style={{
                display: 'block',
                marginTop: '32px',
                background: 'linear-gradient(135deg, #D4AF37, #E8C84A)',
                color: '#000',
                padding: '14px 24px',
                borderRadius: '50px',
                fontWeight: 700,
                fontSize: '13px',
                textDecoration: 'none',
                textAlign: 'center',
                boxShadow: '0 8px 24px rgba(212,175,55,0.35)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Submit Inquiry →
            </a>
          </div>

          {/* QR Code */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', marginBottom: '22px' }}>
              📱 Scan to Connect
            </p>
            <div style={{
              display: 'inline-block',
              background: '#fff',
              borderRadius: '24px',
              padding: '22px',
              boxShadow: '0 24px 72px rgba(0,0,0,0.5), 0 0 0 2px rgba(212,175,55,0.3)',
            }}>
              {/* Real QR Code via qrserver.com — links to pepscorelabs.com inquiry */}
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?data=https%3A%2F%2Fpepscorelabs.com%23inquiry&size=240x240&format=png&margin=8&qzone=1&color=000000&bgcolor=FFFFFF"
                alt="Pepscore Labs QR Code — Scan to inquire"
                width={240}
                height={240}
                style={{ display: 'block', borderRadius: '10px' }}
                loading="eager"
              />
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '18px', fontWeight: 300, lineHeight: 1.65 }}>
              Scan to submit an inquiry,<br />view capabilities, or contact us directly
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '22px', flexWrap: 'wrap' }}>
              <a href="tel:2024253161" style={{
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.35)',
                borderRadius: '50px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#D4AF37',
                textDecoration: 'none',
                letterSpacing: '0.04em',
              }}>
                📞 Call Now
              </a>
              <a href="#inquiry" style={{
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.35)',
                borderRadius: '50px',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#D4AF37',
                textDecoration: 'none',
                letterSpacing: '0.04em',
              }}>
                📋 Inquire
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
