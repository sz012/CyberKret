interface Props {
  id: string
  tilt?: number
  blink?: number
  happy?: boolean
  waving?: number | null
  lamp?: number
  badge?: boolean
}

export function MoleRig({ id, tilt = 0, blink = 0, happy = false, waving = null, lamp = 1, badge = true }: Props) {
  const eye = Math.max(0.35, 1 - blink)
  return (
    <g className="rig">
      <defs>
        <radialGradient id={`${id}-fur`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="var(--mole-2)" />
          <stop offset="1" stopColor="var(--mole)" />
        </radialGradient>
      </defs>
      <ellipse cx="108" cy="188" rx="74" ry="7" fill="#000" opacity="0.32" />
      <path d="M36 140 q-16 -2 -18 -14" fill="none" stroke="var(--snout)" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="80" cy="181" rx="17" ry="7.5" fill="#d98794" />
      <ellipse cx="132" cy="183" rx="17" ry="7.5" fill="var(--snout)" />
      <ellipse cx="150" cy="158" rx="12" ry="9" fill="#d98794" />

      <ellipse cx="102" cy="132" rx="70" ry="54" fill={`url(#${id}-fur)`} />
      <ellipse cx="116" cy="148" rx="40" ry="30" fill="var(--mole-belly)" opacity="0.55" />

      <g transform={`rotate(${tilt} 128 118)`}>
        <circle cx="138" cy="98" r="46" fill={`url(#${id}-fur)`} />
        <ellipse cx="168" cy="108" rx="20" ry="15" fill="var(--mole-2)" />
        <ellipse cx="188" cy="107" rx="17" ry="12" fill="var(--snout)" />
        <ellipse cx="192" cy="102" rx="6" ry="3" fill="#fff" opacity="0.5" />
        <circle cx="198" cy="109" r="1.6" fill="#8a3f4c" />
        <circle cx="192" cy="111" r="1.6" fill="#8a3f4c" />
        <path d="M178 116 l26 8 M176 120 l22 14 M178 112 l28 0" stroke="#c9ced8" strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
        <path d={happy ? 'M157 120 q9 10 18 0' : 'M158 122 q8 6 16 0'} fill="none" stroke="#231f1e" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="152" cy="114" rx="7" ry="4" fill="var(--snout)" opacity={happy ? 0.65 : 0.4} />
        {happy ? (
          <g fill="none" stroke="#111" strokeLinecap="round">
            <path d="M141 95 q6 -6 12 0" strokeWidth="2.6" />
            <path d="M119 97 q5 -5 10 0" strokeWidth="2.4" />
          </g>
        ) : (
          <g>
            <ellipse cx="148" cy="93" rx="3.4" ry={3.4 * eye} fill="#111" />
            <ellipse cx="125" cy="95" rx="3" ry={3 * eye} fill="#111" />
            {eye > 0.6 && (
              <>
                <circle cx="149.4" cy="91.6" r="1.2" fill="#fff" />
                <circle cx="126.2" cy="93.8" r="1" fill="#fff" />
              </>
            )}
          </g>
        )}
        <circle cx="147" cy="93" r="11.5" fill="#fff" fillOpacity="0.07" stroke="#c9ced8" strokeWidth="2.6" />
        <circle cx="124" cy="95" r="10" fill="#fff" fillOpacity="0.07" stroke="#c9ced8" strokeWidth="2.4" />
        <path d="M134 94 q2 -3 1.5 -1" stroke="#c9ced8" strokeWidth="2.4" fill="none" />
        <path d="M114 95 L100 92" stroke="#c9ced8" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M100 80 C 110 52, 162 46, 180 70" fill="none" stroke="#262b34" strokeWidth="8" strokeLinecap="round" />
        <circle cx="156" cy="56" r="12" fill="#3a4150" stroke="#262b34" strokeWidth="2" />
        <circle cx="158" cy="55" r="7.5" fill="#5b6271" />
        <circle cx="158" cy="55" r="7.5" fill="var(--lamp)" opacity={lamp} />
        <circle cx="160.5" cy="52.5" r="2.4" fill="#fff" opacity={0.35 + 0.55 * lamp} />
      </g>

      {badge && (
        <g>
          <path d="M120 138 L108 156 M132 140 L126 156" stroke="var(--lamp)" strokeWidth="2" />
          <rect x="96" y="154" width="38" height="24" rx="4" fill="#eef0f3" />
          <rect x="96" y="154" width="38" height="7" rx="3" fill="var(--lamp)" />
          <text x="115" y="173" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fontWeight="600" fill="#1a1d23">
            KRET
          </text>
        </g>
      )}

      {waving !== null ? (
        <g transform={`rotate(${-8 + 16 * Math.sin(waving)} 150 130)`}>
          <path d="M150 130 C 170 120, 182 100, 186 84" fill="none" stroke="var(--mole)" strokeWidth="18" strokeLinecap="round" />
          <ellipse cx="188" cy="76" rx="13" ry="15" fill="var(--snout)" />
          <path d="M180 64 l-2 -8 M188 62 l0 -9 M196 64 l2 -8" stroke="#fbe3e7" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M140 130 C 158 134, 168 140, 176 144" fill="none" stroke="var(--mole)" strokeWidth="18" strokeLinecap="round" />
          <ellipse cx="180" cy="146" rx="15" ry="11" fill="var(--snout)" />
          <path d="M190 138 l7 -3 M193 145 l8 0 M190 152 l7 3" stroke="#fbe3e7" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}
