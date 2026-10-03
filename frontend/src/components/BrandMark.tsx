import { MARK_ARM, MARK_LAMP, MARK_LEG, MARK_STEM } from './markPaths'

export function BrandMark({ size = 30, paper = false }: { size?: number; paper?: boolean }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke={paper ? '#1b1d22' : 'var(--fg)'} strokeWidth="8" strokeLinecap="round">
        <path d={MARK_STEM} />
        <path d={MARK_ARM} />
        <path d={MARK_LEG} />
      </g>
      <circle cx={MARK_LAMP.x} cy={MARK_LAMP.y} r={MARK_LAMP.r} fill={paper ? '#d39410' : 'var(--lamp)'} />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span>cyber</span>Kret
    </span>
  )
}
