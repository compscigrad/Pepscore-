'use client'

// Renders a branded single-vial SVG that matches the existing product image style.
// Used for any product that does not have a dedicated photograph.

interface Props {
  productName: string
  className?: string
}

// Breaks a product name into ≤ 3 display lines that fit inside the vial label (≈13 chars each).
function labelLines(name: string): string[] {
  if (name.length <= 14) return [name]

  const words = name.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= 13) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word.length > 13 ? word.slice(0, 12) + '…' : word
      if (lines.length === 2) break
    }
  }
  if (current && lines.length < 3) lines.push(current)
  return lines
}

// Picks a font size for the label based on the longest line.
function labelFontSize(lines: string[]): number {
  const max = Math.max(...lines.map(l => l.length))
  if (max <= 6) return 16
  if (max <= 10) return 14
  if (max <= 13) return 12
  return 10
}

export function SingleVialImage({ productName, className }: Props) {
  // SVG gradient IDs must be unique per instance on the same page.
  const uid = productName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()

  const lines = labelLines(productName)
  const fontSize = labelFontSize(lines)

  // Vertical centre of the text block within the label area (210–290).
  const totalTextHeight = lines.length * (fontSize + 4)
  const textStartY = 250 - totalTextHeight / 2

  return (
    <svg
      viewBox="0 0 200 380"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${productName} research vial`}
      role="img"
    >
      <defs>
        {/* Glass body */}
        <linearGradient id={`glass_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#c8c8c8" stopOpacity="0.65"/>
          <stop offset="18%"  stopColor="#eeeeee" stopOpacity="0.82"/>
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.92"/>
          <stop offset="82%"  stopColor="#e8e8e8" stopOpacity="0.82"/>
          <stop offset="100%" stopColor="#c0c0c0" stopOpacity="0.65"/>
        </linearGradient>
        {/* Gold cap body */}
        <linearGradient id={`cap_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#6e4e0c"/>
          <stop offset="28%"  stopColor="#bf8a1e"/>
          <stop offset="55%"  stopColor="#dba730"/>
          <stop offset="80%"  stopColor="#bf8a1e"/>
          <stop offset="100%" stopColor="#6e4e0c"/>
        </linearGradient>
        {/* Gold cap top face */}
        <radialGradient id={`capTop_${uid}`} cx="45%" cy="40%" r="55%">
          <stop offset="0%"   stopColor="#f0c84a"/>
          <stop offset="100%" stopColor="#b07a14"/>
        </radialGradient>
        {/* Silver crimp */}
        <linearGradient id={`crimp_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#868686"/>
          <stop offset="38%"  stopColor="#d8d8d8"/>
          <stop offset="62%"  stopColor="#f2f2f2"/>
          <stop offset="82%"  stopColor="#c0c0c0"/>
          <stop offset="100%" stopColor="#848484"/>
        </linearGradient>
        {/* Gold stripe */}
        <linearGradient id={`gold_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#9a6a10"/>
          <stop offset="40%"  stopColor="#d4962a"/>
          <stop offset="60%"  stopColor="#dba730"/>
          <stop offset="100%" stopColor="#9a6a10"/>
        </linearGradient>
      </defs>

      {/* ── Vial glass body ── */}
      <rect x="33" y="90" width="134" height="268" rx="22"
        fill={`url(#glass_${uid})`} stroke="#c0c0c0" strokeWidth="1.2"/>

      {/* Shoulder (top rounded shoulders) */}
      <path d="M33,112 Q33,90 58,90 L142,90 Q167,90 167,112"
        fill={`url(#glass_${uid})`} stroke="#c0c0c0" strokeWidth="1.2"/>

      {/* Neck */}
      <rect x="62" y="44" width="76" height="52" rx="10"
        fill={`url(#glass_${uid})`} stroke="#c0c0c0" strokeWidth="1.2"/>

      {/* ── Gold cap ── */}
      <rect x="56" y="12" width="88" height="40" rx="9"
        fill={`url(#cap_${uid})`}/>
      <ellipse cx="100" cy="12" rx="44" ry="8.5"
        fill={`url(#capTop_${uid})`}/>
      {/* Cap bottom rim shading */}
      <ellipse cx="100" cy="52" rx="44" ry="5"
        fill="#b07a14" opacity="0.55"/>

      {/* ── Silver crimp ring ── */}
      <rect x="51" y="68" width="98" height="20" rx="5"
        fill={`url(#crimp_${uid})`}/>

      {/* ── White paper label ── */}
      <rect x="40" y="106" width="120" height="228" rx="5" fill="white"/>

      {/* Label: gold stripe top */}
      <rect x="40" y="106" width="120" height="11" rx="3"
        fill={`url(#gold_${uid})`}/>

      {/* ── Molecular network icon (matches existing vial imagery) ── */}
      <g transform="translate(100,162)" fill="none"
         stroke="#c9952a" strokeWidth="2.3" strokeLinecap="round">
        {/* Nodes */}
        <circle cx="-22" cy="0"   r="5.5" fill="#c9952a" stroke="none"/>
        <circle cx="10"  cy="-20" r="5.5" fill="#c9952a" stroke="none"/>
        <circle cx="20"  cy="14"  r="5.5" fill="#c9952a" stroke="none"/>
        <circle cx="-4"  cy="-8"  r="4"   fill="#c9952a" stroke="none"/>
        {/* Bonds */}
        <line x1="-17" y1="-1"  x2="-8"  y2="-5"/>
        <line x1="-1"  y1="-8"  x2="5"   y2="-16"/>
        <line x1="15"  y1="-17" x2="17"  y2="9"/>
        <line x1="-18" y1="4"   x2="15"  y2="16"/>
      </g>

      {/* Label: gold divider stripe */}
      <rect x="40" y="204" width="120" height="7" rx="2"
        fill={`url(#gold_${uid})`}/>

      {/* ── Product name text ── */}
      {lines.map((line, i) => (
        <text
          key={i}
          x="100"
          y={textStartY + i * (fontSize + 5)}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize={fontSize}
          fontWeight="bold"
          fill="#7a5810"
          textAnchor="middle"
          dominantBaseline="auto"
        >
          {line}
        </text>
      ))}

      {/* Label: "FOR RESEARCH PURPOSES ONLY" */}
      <text x="100" y="293"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="7.2" fill="#a07828"
        textAnchor="middle" letterSpacing="0.6">
        FOR RESEARCH
      </text>
      <text x="100" y="304"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="7.2" fill="#a07828"
        textAnchor="middle" letterSpacing="0.6">
        PURPOSES ONLY
      </text>

      {/* Label: gold stripe bottom */}
      <rect x="40" y="318" width="120" height="11" rx="3"
        fill={`url(#gold_${uid})`}/>

      {/* ── Glass highlight / reflection streak ── */}
      <rect x="44" y="98" width="10" height="256" rx="5"
        fill="white" opacity="0.42"/>

      {/* Subtle bottom glass curve shading */}
      <ellipse cx="100" cy="356" rx="55" ry="6"
        fill="#b8b8b8" opacity="0.22"/>
    </svg>
  )
}
