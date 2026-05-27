// ── LandingCapabilities.tsx ──────────────────────────────────────────────────
// Capabilities / features grid — luxury dark + gold

const CAPABILITIES = [
  { icon: '🧪', title: 'COA Certified', desc: 'Every batch ships with a Certificate of Analysis — full transparency on composition, purity, and testing results.' },
  { icon: '🔒', title: 'Sterile Manufacturing', desc: 'Controlled clean-room environments and sterile synthesis protocols for pharmaceutical-grade consistency.' },
  { icon: '⚗️', title: '99.9% Purity Standard', desc: 'Industry-leading purity standards verified by HPLC and mass spectrometry on every production batch.' },
  { icon: '📦', title: 'Wholesale & Retail Packaging', desc: 'Advanced packaging systems for both bulk wholesale distribution and premium retail-ready presentation.' },
  { icon: '🧬', title: 'Vials, Kits & Bulk Solutions', desc: 'Comprehensive product formats — individual vials, complete kits, and bulk solution packaging for every scale.' },
  { icon: '🏭', title: 'Advanced Packaging Systems', desc: 'Precision labeling, tamper-evident sealing, and cold-chain optimized packaging for transport integrity.' },
  { icon: '🤝', title: 'Wholesale Partnerships', desc: 'Tiered wholesale pricing, dedicated account management, and priority fulfillment for volume buyers.' },
  { icon: '📋', title: 'Full Compliance Documentation', desc: 'Complete regulatory documentation, batch records, and chain of custody paperwork with every shipment.' },
]

export default function LandingCapabilities() {
  return (
    <section id="capabilities" style={{
      padding: '96px 24px 112px',
      background: 'linear-gradient(180deg, #0D0D0D 0%, #0A0A00 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle gold line top */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '200px', height: '1px',
        background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
      }} />

      <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', marginBottom: '16px' }}>
            What We Deliver
          </p>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 48px)', fontWeight: 800, color: '#fff', marginBottom: '14px', letterSpacing: '-0.02em' }}>
            Capabilities & Standards
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', fontWeight: 300, maxWidth: '520px', margin: '0 auto', lineHeight: 1.7 }}>
            The infrastructure and quality standards that define Pepscore Labs.
          </p>
          <div style={{ width: '52px', height: '2px', background: 'linear-gradient(90deg, #D4AF37, #E8C84A)', margin: '24px auto 0', borderRadius: '4px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
          {CAPABILITIES.map((c, i) => (
            <div
              key={c.title}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,175,55,0.12)',
                borderRadius: '18px',
                padding: '32px 26px',
                transition: 'all 0.3s ease',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.45)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(212,175,55,0.05)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(212,175,55,0.1)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(212,175,55,0.12)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '14px' }}>{c.icon}</div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '10px', letterSpacing: '0.02em' }}>{c.title}</h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, fontWeight: 300 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
