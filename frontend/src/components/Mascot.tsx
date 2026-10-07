import { useId } from 'react'
import { LAMP, LEG_FROM, MARK_LEG, MARK_M } from './markPaths'

export type Pose = 'idle' | 'dig' | 'check' | 'happy' | 'alarm' | 'report'

const STATE: Record<Pose, string> = {
  idle: 'waiting',
  dig: 'checking',
  check: 'analysing',
  happy: 'all good',
  alarm: 'alarm',
  report: 'report ready',
}

interface Props {
  size?: number
  pose?: Pose
  className?: string
}

export default function Mascot({ size = 160, pose = 'idle', className = '' }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const box = Math.round(size * 0.78)
  const { x, y, ring } = LAMP
  return (
    <svg className={`kret kret-${pose} ${className}`} viewBox="6 4 88 88" width={box} height={box} role="img" aria-label={`Mole: ${STATE[pose]}`}>
      <defs>
        <radialGradient id={`kret-glow-${id}`}>
          <stop offset="0.2" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`kret-leg-${id}`} gradientUnits="userSpaceOnUse" x1={LEG_FROM.x} y1={LEG_FROM.y} x2={x} y2={y}>
          <stop offset="0.2" stopColor="var(--fg-2)" />
          <stop offset="0.95" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <circle className="kret-halo" cx={x} cy={y} r="22" fill={`url(#kret-glow-${id})`} />
      {(pose === 'check' || pose === 'alarm') && (
        <g className="kret-ripples">
          <circle cx={x} cy={y} r="9" />
          <circle cx={x} cy={y} r="9" />
        </g>
      )}
      <g className="kret-k">
        <path d={MARK_M} />
      </g>
      <path className="kret-leg" d={MARK_LEG} stroke={`url(#kret-leg-${id})`} />
      {pose === 'dig' && <path className="kret-flow" d={MARK_LEG} />}
      <circle className="kret-ring" cx={x} cy={y} r={ring} />
      <circle className="kret-lamp" cx={x} cy={y} r="5.7" />
      <circle className="kret-spark" cx={x - 1.7} cy={y - 1.7} r="1.8" />
    </svg>
  )
}
