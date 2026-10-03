import { mixHex, span, toward, type Pt } from './geometry'
import { COLD, INTRUDER, T, WARM, beamAngle, blipProgress } from './timeline'

interface ProbeProps {
  p: Pt
  warm: number
  bright: number
  spin: number
  ring: number
  speed?: number
  alarm?: number
  scale?: number
}

export function Probe({ p, warm, bright, spin, ring, speed = 0, alarm = 0, scale = 1 }: ProbeProps) {
  const color = mixHex(mixHex(COLD, '#ffb9b3', alarm * 0.6), WARM, warm)
  const arc = (2 * Math.PI * ring) / 3
  const outer = ring + 7
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${scale})`}>
      <g className="kf-glow">
        <circle r={ring * 5.5} fill="url(#kf-glow-cold)" opacity={(1 - warm) * 0.85 * bright} />
        <circle r={ring * 5.5} fill="url(#kf-glow-warm)" opacity={warm * 0.85 * bright} />
        {speed > 0.04 && (
          <>
            <rect x="-1.6" y={-70 * speed} width="3.2" height={140 * speed} rx="1.6" fill={color} opacity={0.5 * speed} />
            <rect x="-6" y={-46 * speed} width="12" height={92 * speed} rx="6" fill={color} opacity={0.12 * speed} />
          </>
        )}
      </g>
      <g transform={`rotate(${spin})`}>
        <circle r={ring} fill="none" stroke={color} strokeWidth="1.4" strokeDasharray={`${arc * 0.72} ${arc * 0.28}`} opacity="0.9" />
      </g>
      <g transform={`rotate(${-spin * 0.55})`}>
        <circle r={outer} fill="none" stroke={color} strokeWidth="0.8" strokeDasharray={`1 ${(2 * Math.PI * outer) / 36 - 1}`} opacity="0.5" />
      </g>
      <circle r={ring * 0.5} fill={color} opacity={0.22 * bright} />
      <circle r="7.5" fill={color} opacity={Math.min(1, bright)} />
      <circle r="3.3" fill="#fffaf0" opacity={Math.min(1, bright)} />
    </g>
  )
}

export function ScanBeam({ t, from }: { t: number; from: Pt }) {
  const opacity = span(t, T.scan[0], T.scan[0] + 220) * (1 - span(t, T.scan[1] - 120, T.scan[1] + 160))
  if (opacity <= 0.01) return null
  const angle = beamAngle(t)
  const spread = 6
  const length = 980
  const lead = toward(from, angle - spread, length)
  const tail = toward(from, angle + spread, length)
  const end = toward(from, angle, length)
  return (
    <g className="kf-glow" opacity={opacity}>
      <defs>
        <linearGradient id="kf-scan" gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={end.x} y2={end.y}>
          <stop offset="0" stopColor={WARM} stopOpacity="0.5" />
          <stop offset="0.6" stopColor={WARM} stopOpacity="0.12" />
          <stop offset="1" stopColor={WARM} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${from.x},${from.y} ${lead.x},${lead.y} ${tail.x},${tail.y}`} fill="url(#kf-scan)" />
      <line x1={from.x} y1={from.y} x2={lead.x} y2={lead.y} stroke="url(#kf-scan)" strokeWidth="1.6" />
    </g>
  )
}

export function Blip({ t }: { t: number }) {
  const opacity = span(t, T.blip[0], T.blip[0] + 250) * (1 - span(t, T.blip[3] - 150, T.blip[3] + 150))
  if (opacity <= 0) return null
  const u = blipProgress(t)
  const p = INTRUDER.at(u)
  const trail = 200
  return (
    <g opacity={opacity}>
      <path
        d={INTRUDER.d}
        fill="none"
        stroke={COLD}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
        strokeDasharray={`${trail} ${INTRUDER.length}`}
        strokeDashoffset={-(u * INTRUDER.length - trail)}
      />
      <g className="kf-glow">
        <circle cx={p.x} cy={p.y} r="70" fill="url(#kf-glow-cold)" opacity="0.8" />
      </g>
      <circle cx={p.x} cy={p.y} r="5.5" fill={COLD} />
      <circle cx={p.x} cy={p.y} r="2.6" fill="#ffffff" />
    </g>
  )
}
