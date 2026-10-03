import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KretResult, KretTarget } from '../api/types'
import { iconPaths } from '../components/iconPaths'
import { MoleFigure } from '../components/Mascot'
import { countLabel } from '../lib/format'
import {
  ENTRY_HOLES,
  MOLE_HOME,
  POSITION_LABELS,
  POSITION_LAYOUT,
  STRATA,
  SURFACE_Y,
  TARGET_IDS,
  VIEW,
  footholdTone,
  pathSegments,
  routePath,
  segmentKey,
  segmentPath,
  targetTone,
  type Point,
  type Tone,
} from './layout'
import { resultLine, type DigLine } from './lines'

interface Props {
  result: KretResult | null
  orgName: string
  digToken?: number
  skipToken?: number
  highlight?: string | null
  onLog?: (line: DigLine) => void
  onDigEnd?: () => void
}

const TARGET_ICONS: Record<string, string> = {
  client_data_read: 'folder',
  ksef_access: 'file',
  clients_pay_attacker: 'coins',
  deadlines_missed: 'calendar',
}

const STARS = [
  [80, 26, 1.2],
  [210, 50, 1],
  [330, 18, 1.4],
  [470, 40, 1],
  [700, 30, 1.1],
  [860, 16, 1.3],
  [950, 52, 1],
]

const PEBBLES = [
  [60, 300, 9, 5],
  [300, 170, 6, 4],
  [520, 330, 10, 6],
  [640, 440, 8, 5],
  [930, 330, 11, 6],
  [150, 420, 7, 4],
  [960, 470, 7, 4],
  [560, 590, 9, 5],
  [880, 190, 6, 3],
]

function statusText(tone: Tone, target: KretTarget | undefined, isTarget: boolean): string {
  if (isTarget && target) {
    if (target.open) return countLabel(target.open + target.possible, 'droga', 'drogi', 'dróg')
    if (target.possible) return `${target.possible} niepewne`
    return 'zamknięte'
  }
  if (tone === 'bad') return 'otwarte'
  if (tone === 'warn') return 'niepewne'
  return tone === 'idle' ? 'zamknięte' : 'w porządku'
}

export function GroundMap({ result, orgName, digToken = 0, skipToken = 0, highlight, onLog, onDigEnd }: Props) {
  const gradientId = `map-beam-${useId().replace(/:/g, '')}`
  const moleRef = useRef<SVGGElement>(null)
  const flipRef = useRef<SVGGElement>(null)
  const probeRef = useRef<SVGPathElement>(null)
  const skipRef = useRef(false)
  const [digging, setDigging] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const latest = useRef({ result, orgName, onLog, onDigEnd })

  useEffect(() => {
    latest.current = { result, orgName, onLog, onDigEnd }
  })

  useEffect(() => {
    if (skipToken) skipRef.current = true
  }, [skipToken])

  useEffect(() => {
    const { result, orgName } = latest.current
    if (!digToken || !result) return
    let cancelled = false
    skipRef.current = false
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fast = () => reduce || skipRef.current || cancelled
    const log = (line: DigLine) => {
      if (!cancelled) latest.current.onLog?.(line)
    }
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, fast() ? 0 : ms))
    const place = (point: Point, dx?: number) => {
      moleRef.current?.setAttribute('transform', `translate(${point.x} ${point.y})`)
      if (dx !== undefined && Math.abs(dx) > 0.01) {
        flipRef.current?.setAttribute('transform', dx < 0 ? 'scale(-1 1)' : '')
      }
    }
    const travel = (d: string, ms: number, reverse = false) =>
      new Promise<void>((resolve) => {
        const probe = probeRef.current
        if (!probe || fast()) {
          resolve()
          return
        }
        probe.setAttribute('d', d)
        const length = probe.getTotalLength()
        let start: number | null = null
        let previous: DOMPoint | null = null
        const step = (now: number) => {
          if (fast()) {
            resolve()
            return
          }
          start ??= now
          const k = Math.min(1, (now - start) / ms)
          const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
          const point = probe.getPointAtLength((reverse ? 1 - eased : eased) * length)
          place(point, previous ? point.x - previous.x : undefined)
          previous = point
          if (k < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })

    const run = async () => {
      setDigging(true)
      setRevealed(new Set())
      log({ text: `> kret wchodzi pod ${orgName}, sprawdza ${countLabel(result.targets.length, 'miejsce', 'miejsca', 'miejsc')}`, tone: 'hi' })
      await wait(450)
      let at: Point = MOLE_HOME
      for (const story of result.stories) {
        if (cancelled) return
        const path = result.paths.find((p) => p.id === story.path)
        const route = path ? routePath(path) : null
        const target = result.targets.find((t) => t.id === story.target)
        if (!path || !route || !target) continue
        log({ text: `> ${target.label}: idę drogą ${path.steps.map((s) => s.name.toLowerCase()).join(' → ')}` })
        await travel(`M${at.x} ${MOLE_HOME.y} L${route.start.x} ${MOLE_HOME.y} L${route.start.x} ${SURFACE_Y}`, 380)
        await travel(route.d, 1000)
        if (cancelled) return
        const own = result.paths.filter((p) => p.target === story.target)
        setRevealed((previous) => {
          const next = new Set(previous)
          for (const item of own) {
            for (const key of pathSegments(item)) next.add(key)
            for (const step of item.steps) next.add(step.target)
          }
          return next
        })
        log(resultLine(target))
        await wait(420)
        await travel(route.d, 520, true)
        at = { x: route.start.x, y: MOLE_HOME.y }
        place(at)
      }
      for (const target of result.targets) {
        if (!target.open && !target.possible) log(resultLine(target))
      }
      await travel(`M${at.x} ${MOLE_HOME.y} L${MOLE_HOME.x} ${MOLE_HOME.y}`, 380)
      if (cancelled) return
      place(MOLE_HOME)
      log({ text: `→ ${result.outro}`, tone: 'hi' })
      setDigging(false)
      latest.current.onDigEnd?.()
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [digToken])

  const lit = useMemo(() => {
    const path = highlight ? result?.paths.find((p) => p.id === highlight) : undefined
    return path ? new Set(pathSegments(path)) : null
  }, [highlight, result])

  const segments = result?.segments ?? []
  const isHidden = (key: string) => digging && !revealed.has(key)
  const holeStatus = (target: string) => segments.find((s) => s.source === 'internet' && s.target === target)?.status

  const summary = result
    ? `Przekrój ziemi pod biurem. ${result.intro}`
    : 'Przekrój ziemi pod biurem. Kret jeszcze nie kopał.'

  return (
    <div className="ground-scroll">
      <svg className={`ground${digging ? ' is-digging' : ''}`} viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="img" aria-label={summary}>
        <rect x="0" y="0" width={VIEW.width} height={SURFACE_Y} fill="var(--sky)" />
        <g fill="var(--fg)" opacity="0.45">
          {STARS.map(([cx, cy, r]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
        {STRATA.map((band, index) => (
          <g key={band.label}>
            <rect x="0" y={band.y} width={VIEW.width} height={band.height} fill={band.fill} />
            {index > 0 && (
              <path
                d={`M0 ${band.y}c160 -8 280 7 440 -1s320 9 560 -3`}
                fill="none"
                stroke="var(--soil-3)"
                strokeWidth="1.5"
                opacity="0.8"
              />
            )}
            <text className="stratum-label" x={VIEW.width - 16} y={band.y + band.height - 12} textAnchor="end">
              {band.label}
            </text>
          </g>
        ))}
        <g fill="#4a3a2f" opacity="0.7">
          {PEBBLES.map(([cx, cy, rx, ry]) => (
            <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} />
          ))}
        </g>

        <path d={`M0 ${SURFACE_Y}H${VIEW.width}`} stroke="#4f6b3a" strokeWidth="5" />
        <g stroke="#5f7d45" strokeWidth="2" strokeLinecap="round">
          <path d="M40 100l-3-8M44 100l2-9M150 100l-2-7M300 100l3-8M304 100l-1-6M680 100l-3-8M720 100l2-7M850 100l-2-8M960 100l3-7" />
        </g>

        <g className="office">
          <path d="M540 102c0-24 26-38 60-38s60 14 60 38z" fill="#4a3a2e" />
          <rect x="568" y="42" width="64" height="44" rx="3" fill="var(--soil-2)" stroke="var(--soil-3)" />
          <path d="M562 44l38-20 38 20z" fill="var(--soil-3)" />
          <rect x="577" y="52" width="14" height="12" fill="var(--lamp)" opacity="0.85" />
          <rect x="609" y="52" width="14" height="12" fill="var(--lamp)" opacity="0.35" />
          <rect x="593" y="68" width="14" height="18" fill="var(--soil-0)" />
          <text className="office-label" x="600" y="16" textAnchor="middle">
            {orgName}
          </text>
        </g>

        {Object.entries(ENTRY_HOLES).map(([target, hole]) => {
          const status = holeStatus(target) ?? 'closed'
          const hidden = isHidden(segmentKey('internet', target))
          return (
            <g key={target} className={`hole hole--${hidden ? 'closed' : status}`}>
              <ellipse cx={hole.x} cy={SURFACE_Y - 1} rx="17" ry="5" />
              <text
                className="hole-label"
                x={hole.x + (hole.anchor === 'start' ? 24 : -24)}
                y={SURFACE_Y - 12}
                textAnchor={hole.anchor}
              >
                {hole.label}
              </text>
            </g>
          )
        })}

        <g className={`tunnels${lit ? ' has-highlight' : ''}`}>
          {segments.map((segment) => {
            const key = segmentKey(segment.source, segment.target)
            const d = segmentPath(segment.source, segment.target)
            if (!d) return null
            const classes = ['seg', `seg--${segment.status}`]
            if (isHidden(key)) classes.push('is-hidden')
            if (lit?.has(key)) classes.push('is-lit')
            return (
              <g key={key} className={classes.join(' ')}>
                <title>{segment.names.join(', ')}</title>
                <path className="tw" d={d} />
                <path className="tc" d={d} />
                <path className="tl" d={d} />
              </g>
            )
          })}
        </g>

        {Object.entries(POSITION_LAYOUT).map(([id, layout]) => {
          const isTarget = TARGET_IDS.includes(id)
          const target = result?.targets.find((t) => t.id === id)
          const label = result?.positions.find((p) => p.id === id)?.label ?? POSITION_LABELS[id] ?? id
          const tone: Tone = isHidden(id) ? 'idle' : isTarget ? targetTone(result, id) : footholdTone(result, id)
          const pending = !result || isHidden(id)
          const text = pending ? '…' : statusText(tone, target, isTarget)
          const name =
            layout.label === 'right'
              ? { x: layout.x + layout.r + 16, y: layout.y + 2, anchor: 'start' as const }
              : layout.label === 'below-right'
                ? { x: layout.x + 22, y: layout.y + layout.r + 30, anchor: 'start' as const }
                : { x: layout.x, y: layout.y + layout.r + 30, anchor: 'middle' as const }
          return (
            <g
              key={id}
              className={`chamber chamber--${tone}${isTarget ? ' chamber--target' : ''}`}
              transform={`translate(${layout.x} ${layout.y})`}
            >
              <circle className="glow" r={layout.r + 16} />
              <circle className="core" r={layout.r} />
              {isTarget && (
                <g
                  className="chamber-icon"
                  transform="translate(-11 -11) scale(0.92)"
                  fill="none"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {iconPaths(TARGET_ICONS[id] ?? 'shield').map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              )}
              <text className="name" x={name.x - layout.x} y={name.y - layout.y} textAnchor={name.anchor}>
                {label}
              </text>
              <text className="st" x={name.x - layout.x} y={name.y - layout.y + 18} textAnchor={name.anchor}>
                {text}
              </text>
            </g>
          )
        })}

        <path ref={probeRef} d="" fill="none" stroke="none" />
        <g ref={moleRef} transform={`translate(${MOLE_HOME.x} ${MOLE_HOME.y})`} className="map-mole">
          <g ref={flipRef}>
            <g transform="scale(0.3) translate(-86 -84)">
              <MoleFigure mood={digging ? 'dig' : 'calm'} gradientId={gradientId} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
