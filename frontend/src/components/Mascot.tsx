import { useId } from 'react'

/*
 * CyberKret: our own mole. Round charcoal body, pink snout and digging paws, round glasses,
 * a headlamp and a network plug instead of a shovel. Drawn from scratch for this project.
 */

export type Pose = 'idle' | 'dig' | 'check' | 'happy' | 'alarm' | 'report'

interface GlyphProps {
  pose?: Pose
  lamp?: boolean
  beam?: boolean
  badge?: boolean
  cable?: boolean
}

/** Mole drawn in a 220×200 box, facing right. Body centre is around (120, 125). */
export function MoleGlyph({ pose = 'idle', lamp = true, beam = false, badge = true, cable = true }: GlyphProps) {
  const uid = useId().replace(/:/g, '')
  const happy = pose === 'happy'
  const alarm = pose === 'alarm'
  const holdsPlug = pose === 'idle' || pose === 'check' || pose === 'alarm'
  return (
    <g className={`mole mole-${pose}`}>
      <defs>
        <linearGradient id={`beam-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--lamp)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--lamp)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`fur-${uid}`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="var(--mole-2)" />
          <stop offset="1" stopColor="var(--mole)" />
        </radialGradient>
      </defs>

      {beam && lamp && <path className="mole-beam" d="M166 54 L360 4 L360 120 Z" fill={`url(#beam-${uid})`} />}

      <ellipse cx="108" cy="188" rx="72" ry="7" fill="#000" opacity="0.28" />

      {cable && holdsPlug && (
        <g className="mole-cable">
          <path d="M196 140 C 214 170, 150 196, 80 192 S -10 180, -40 196" fill="none" stroke="#1f3b66" strokeWidth="9" strokeLinecap="round" />
          <path d="M196 140 C 214 170, 150 196, 80 192 S -10 180, -40 196" fill="none" stroke="var(--net)" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {/* tail */}
      <path d="M36 140 q-16 -2 -18 -14" fill="none" stroke="var(--snout)" strokeWidth="5" strokeLinecap="round" />

      {/* feet */}
      <ellipse cx="80" cy="181" rx="17" ry="7.5" fill="#d98794" />
      <ellipse cx="132" cy="183" rx="17" ry="7.5" fill="var(--snout)" />

      {/* far paw */}
      <g className="mole-paw-far">
        <ellipse cx="150" cy="158" rx="12" ry="9" fill="#d98794" />
      </g>

      {/* body + head */}
      <g className="mole-body">
        <ellipse cx="102" cy="132" rx="70" ry="54" fill={`url(#fur-${uid})`} />
        <circle cx="138" cy="98" r="46" fill={`url(#fur-${uid})`} />
        <ellipse cx="116" cy="148" rx="40" ry="30" fill="var(--mole-belly)" opacity="0.55" />

        {/* muzzle + snout */}
        <ellipse cx="168" cy="108" rx="20" ry="15" fill="var(--mole-2)" />
        <ellipse cx="188" cy="107" rx="17" ry="12" fill="var(--snout)" />
        <ellipse cx="192" cy="102" rx="6" ry="3" fill="#fff" opacity="0.5" />
        <circle cx="198" cy="109" r="1.6" fill="#8a3f4c" />
        <circle cx="192" cy="111" r="1.6" fill="#8a3f4c" />
        <path d="M178 116 l26 8 M176 120 l22 14 M178 112 l28 0" stroke="#c9ced8" strokeWidth="1.2" opacity="0.55" strokeLinecap="round" />
        <path d={alarm ? 'M158 124 q8 -4 16 0' : 'M158 122 q8 7 16 0'} fill="none" stroke="#231f1e" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="152" cy="114" rx="7" ry="4" fill="var(--snout)" opacity="0.4" />

        {/* glasses + eyes */}
        <g className="mole-eyes">
          {happy ? (
            <>
              <path d="M141 95 q6 -6 12 0" fill="none" stroke="#111" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M119 97 q5 -5 10 0" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="148" cy="93" r={alarm ? 4.6 : 3.4} fill="#111" />
              <circle cx="125" cy="95" r={alarm ? 4 : 3} fill="#111" />
              <circle cx="149.4" cy="91.6" r="1.2" fill="#fff" />
              <circle cx="126.2" cy="93.8" r="1" fill="#fff" />
            </>
          )}
        </g>
        <circle cx="147" cy="93" r="11.5" fill="#fff" fillOpacity="0.07" stroke="#c9ced8" strokeWidth="2.6" />
        <circle cx="124" cy="95" r="10" fill="#fff" fillOpacity="0.07" stroke="#c9ced8" strokeWidth="2.4" />
        <path d="M134 94 q2 -3 1.5 -1" stroke="#c9ced8" strokeWidth="2.4" fill="none" />
        <path d="M114 95 L100 92" stroke="#c9ced8" strokeWidth="2.2" strokeLinecap="round" />
        {alarm && <path d="M138 76 l14 -4 M118 80 l12 -2" stroke="#231f1e" strokeWidth="2.4" strokeLinecap="round" />}

        {/* headlamp */}
        <path d="M100 80 C 110 52, 162 46, 180 70" fill="none" stroke="#262b34" strokeWidth="8" strokeLinecap="round" />
        <circle cx="156" cy="56" r="12" fill="#3a4150" stroke="#262b34" strokeWidth="2" />
        <circle className="mole-lamp" cx="158" cy="55" r="7.5" fill={lamp ? 'var(--lamp)' : '#5b6271'} />
        <circle cx="160.5" cy="52.5" r="2.4" fill="#fff" opacity={lamp ? 0.9 : 0.4} />

        {/* badge */}
        {badge && (
          <g className="mole-badge">
            <path d="M120 138 L108 156 M132 140 L126 156" stroke="var(--lamp)" strokeWidth="2" />
            <rect x="96" y="154" width="38" height="24" rx="4" fill="#eef0f3" />
            <rect x="96" y="154" width="38" height="7" rx="3" fill="var(--lamp)" />
            <text x="115" y="173" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fontWeight="600" fill="#1a1d23">KRET</text>
          </g>
        )}
      </g>

      {/* near arm + paw, per pose */}
      {pose === 'happy' ? (
        <g className="mole-wave">
          <path d="M150 130 C 170 120, 182 100, 186 84" fill="none" stroke="var(--mole)" strokeWidth="18" strokeLinecap="round" />
          <ellipse cx="188" cy="76" rx="13" ry="15" fill="var(--snout)" />
          <path d="M180 64 l-2 -8 M188 62 l0 -9 M196 64 l2 -8" stroke="#fbe3e7" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      ) : pose === 'report' ? (
        <g>
          <rect x="150" y="116" width="44" height="56" rx="4" fill="#f2efe6" transform="rotate(8 172 144)" />
          <rect x="164" y="112" width="18" height="8" rx="2" fill="#8e97a8" transform="rotate(8 172 144)" />
          <path d="M158 132 h28 M157 142 h24 M156 152 h28" stroke="#9aa3b2" strokeWidth="2.4" transform="rotate(8 172 144)" />
          <path d="M160 132 l4 4 l7 -8" stroke="var(--ok)" strokeWidth="3" fill="none" transform="rotate(8 172 144)" />
          <ellipse cx="160" cy="160" rx="13" ry="10" fill="var(--snout)" />
        </g>
      ) : (
        <g className="mole-paw-near">
          <path d="M140 130 C 158 134, 168 140, 176 144" fill="none" stroke="var(--mole)" strokeWidth="18" strokeLinecap="round" />
          <ellipse cx="180" cy="146" rx="15" ry="11" fill="var(--snout)" />
          <path d="M190 138 l7 -3 M193 145 l8 0 M190 152 l7 3" stroke="#fbe3e7" strokeWidth="2.4" strokeLinecap="round" />
          {holdsPlug && cable && (
            <g className="mole-plug">
              <rect x="186" y="128" width="22" height="17" rx="3" fill="#d6dbe3" stroke="#8e97a8" strokeWidth="1.5" />
              <path d="M190 131 v6 M194 131 v6 M198 131 v6 M202 131 v6" stroke="var(--copper)" strokeWidth="1.6" />
              <rect x="192" y="144" width="10" height="5" rx="1.5" fill="#b4bcc8" />
            </g>
          )}
        </g>
      )}
    </g>
  )
}

interface MascotProps extends GlyphProps {
  size?: number
  className?: string
  title?: string
}

export default function Mascot({ size = 160, className = '', title = 'CyberKret, maskotka', ...glyph }: MascotProps) {
  return (
    <svg
      className={`mascot ${className}`}
      viewBox="-10 0 240 200"
      width={size}
      height={(size * 200) / 240}
      role="img"
      aria-label={title}
      style={{ overflow: 'visible' }}
    >
      <MoleGlyph {...glyph} />
    </svg>
  )
}
