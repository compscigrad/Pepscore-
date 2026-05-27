// ── LandingPositioning.tsx ───────────────────────────────────────────────────
// Brand positioning section — luxury black, gold accents

export default function LandingPositioning() {
  return (
    <section style={{ padding: '100px 24px', background: '#0A0A0A', textAlign: 'center' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', marginBottom: '20px' }}>
          Brand Positioning
        </p>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, lineHeight: 1.1, color: '#fff', marginBottom: '28px', letterSpacing: '-0.02em' }}>
          Where Science Meets{' '}
          <span style={{
            background: 'linear-gradient(135deg, #C49A1A, #E8C84A)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Precision
          </span>
        </h2>
        <div style={{ width: '52px', height: '2px', background: 'linear-gradient(90deg, #D4AF37, #E8C84A)', margin: '0 auto 36px', borderRadius: '4px' }} />
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.85, fontWeight: 300, marginBottom: '20px', maxWidth: '680px', margin: '0 auto 20px' }}>
          Pepscore Labs is building the next generation of precision peptide packaging and distribution. We deliver pharmaceutical-grade peptide solutions with independently verified purity, sterile manufacturing, and advanced packaging systems for serious research operations.
        </p>
        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.85, fontWeight: 300, maxWidth: '680px', margin: '0 auto 48px' }}>
          Serving wholesale buyers, research facilities, and retail distribution channels with a commitment to quality, discretion, and operational excellence.
        </p>

        {/* 3-pillar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '16px' }}>
          {[
            { icon: '🔬', title: 'Science First', body: 'Every compound verified by independent third-party laboratory testing. HPLC and mass spectrometry confirmed.' },
            { icon: '⚡', title: 'Precision Manufacturing', body: 'Sterile synthesis, controlled environments, and rigorous batch testing for consistent, reliable compounds.' },
            { icon: '🏆', title: 'Performance Grade', body: 'Premium packaging systems, cold-chain logistics, and COA documentation with every order.' },
          ].map(p => (
            <div key={p.title} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(212,175,55,0.15)',
              borderRadius: '20px',
              padding: '36px 28px',
              textAlign: 'center',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.4)'
              ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(212,175,55,0.05)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.15)'
              ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'
            }}
            >
              <div style={{ fontSize: '36px', marginBottom: '16px' }}>{p.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '10px', letterSpacing: '0.02em' }}>{p.title}</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, fontWeight: 300 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
