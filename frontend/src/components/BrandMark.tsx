import { MARK_LAMP, MARK_STROKES, MOLE_LETTERS } from './markPaths'

export function BrandMark({ size = 30, paper = false }: { size?: number; paper?: boolean }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke={paper ? '#1b1d22' : 'var(--fg)'} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        {MARK_STROKES.map((d) => <path key={d} d={d} />)}
      </g>
      <circle cx={MARK_LAMP.x} cy={MARK_LAMP.y} r={MARK_LAMP.r} fill={paper ? '#d39410' : 'var(--lamp)'} />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark" role="img" aria-label="cyberMole">
      <span aria-hidden="true">cyber</span>
      <svg className="wordmark-mole" viewBox="10 6.25 142 51.5" aria-hidden="true">
        <path d={MOLE_LETTERS} fill="none" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
