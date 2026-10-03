import { useId } from 'react'
import { MARK_ARM, MARK_LAMP, MARK_LEG, MARK_STEM } from './markPaths'

export type Pose = 'idle' | 'dig' | 'check' | 'happy' | 'alarm' | 'report'

const STATE: Record<Pose, string> = {
  idle: 'czeka',
  dig: 'sprawdza',
  check: 'analizuje',
  happy: 'wszystko w porządku',
  alarm: 'alarm',
  report: 'raport gotowy',
}

interface Props {
  size?: number
  pose?: Pose
  className?: string
}

export default function Mascot({ size = 160, pose = 'idle', className = '' }: Props) {
  const glow = `kret-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const box = Math.round(size * 0.78)
  const { x, y, r } = MARK_LAMP
  return (
    <svg className={`kret kret-${pose} ${className}`} viewBox="-6 -18 88 88" width={box} height={box} role="img" aria-label={`Kret: ${STATE[pose]}`}>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0.2" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="kret-halo" cx={x} cy={y} r="22" fill={`url(#${glow})`} />
      {(pose === 'check' || pose === 'alarm') && (
        <g className="kret-ripples">
          <circle cx={x} cy={y} r="9" />
          <circle cx={x} cy={y} r="9" />
        </g>
      )}
      <g className="kret-k">
        <path d={MARK_STEM} />
        <path d={MARK_ARM} />
        <path d={MARK_LEG} />
      </g>
      {pose === 'dig' && <path className="kret-flow" d={MARK_ARM} />}
      <circle className="kret-lamp" cx={x} cy={y} r={r} />
      <circle className="kret-spark" cx={x - 1.9} cy={y - 1.9} r="2" />
    </svg>
  )
}
