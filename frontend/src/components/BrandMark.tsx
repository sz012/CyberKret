import { useId } from 'react'
import { LAMP, LEG_FROM, MARK_LEG, MARK_M, MOLE_OLE } from './markPaths'

const useSvgId = () => useId().replace(/[^a-zA-Z0-9_-]/g, '')

function LegFade({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={LEG_FROM.x} y1={LEG_FROM.y} x2={LAMP.x} y2={LAMP.y}>
      <stop offset="0.2" stopColor={from} />
      <stop offset="0.95" stopColor={to} />
    </linearGradient>
  )
}

export function BrandMark({ size = 30, paper = false }: { size?: number; paper?: boolean }) {
  const id = useSvgId()
  const ink = paper ? '#1b1d22' : 'var(--fg)'
  const lamp = paper ? '#d39410' : 'var(--lamp)'
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="7.2 4.8 71 71" aria-hidden="true">
      <defs>
        <LegFade id={`leg-${id}`} from={ink} to={lamp} />
      </defs>
      <g fill="none" strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={MARK_M} stroke={ink} />
        <path d={MARK_LEG} stroke={`url(#leg-${id})`} />
      </g>
      <circle cx={LAMP.x} cy={LAMP.y} r={LAMP.ring} fill="none" stroke={lamp} strokeWidth="1.8" opacity="0.6" />
      <circle cx={LAMP.x} cy={LAMP.y} r="5.7" fill={lamp} />
    </svg>
  )
}

export function Wordmark() {
  const id = useSvgId()
  return (
    <span className="wordmark" role="img" aria-label="cyberMole">
      <span aria-hidden="true">cyber</span>
      <svg className="wordmark-mole" viewBox="10 6.25 152 51.5" aria-hidden="true">
        <defs>
          <LegFade id={`leg-${id}`} from="currentColor" to="var(--lamp)" />
          <radialGradient id={`glow-${id}`}>
            <stop offset="0" stopColor="var(--lamp)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--lamp)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`lit-${id}`} cx="0.42" cy="0.4" r="0.62">
            <stop offset="0" stopColor="#fff7e2" />
            <stop offset="0.55" stopColor="var(--lamp-2)" />
            <stop offset="1" stopColor="var(--lamp)" />
          </radialGradient>
        </defs>
        <circle cx={LAMP.x} cy={LAMP.y} r="15.6" fill={`url(#glow-${id})`} />
        <g fill="none" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={`${MARK_M} ${MOLE_OLE}`} stroke="currentColor" />
          <path d={MARK_LEG} stroke={`url(#leg-${id})`} />
        </g>
        <circle cx={LAMP.x} cy={LAMP.y} r={LAMP.ring} fill="none" stroke="var(--lamp)" strokeWidth="1.4" opacity="0.6" />
        <circle cx={LAMP.x} cy={LAMP.y} r="5.2" fill={`url(#lit-${id})`} />
      </svg>
    </span>
  )
}
