import { useEffect, useMemo, useRef, useState } from 'react'
import type { KretRun, Level, Org, Tunnel } from '../api/types'
import { IconG } from './icons'

/*
 * Cross-section of the office. Above the raised floor: desks, a rack and the internet uplink.
 * Below it: network cables from the patch panel to every "chamber" (a thing the kret checks).
 * The kret rides inside the cables. Attack tunnels are drawn as red lines from the internet to what hurts.
 */

export const HUB = { x: 500, y: 186 }
const CLOUD = { x: 86, y: 58 }
const TARGET_ICON: Record<string, string> = { client_data_read: 'folder', money_stolen: 'money', operations_stopped: 'briefcase' }
const STATUS_TEXT: Record<string, string> = { ok: 'w porządku', warn: 'do sprawdzenia', bad: 'otwarte', checking: 'kret sprawdza', pending: '…', idle: '' }

export type ChamberState = Level | 'checking' | 'pending' | 'idle'

export interface DigEvent {
  kind: 'start' | 'dig' | 'result' | 'tunnel' | 'done'
  chamber?: string
  text: string
  level?: Level | 'info'
}

interface Props {
  org: Org
  run: KretRun | null
  digToken?: number // change to start a dig animation of `run`
  fast?: boolean
  onEvent?: (e: DigEvent) => void
  selected?: string | null // tunnel id
  onSelect?: (id: string | null) => void
  impact?: { untrusted: string[]; at_risk: string[] } | null
  compact?: boolean
}

export function cablePath(x: number, y: number) {
  const endY = y - 36
  return `M${HUB.x} ${HUB.y + 10} C ${HUB.x} ${HUB.y + 70}, ${x} ${Math.min(endY - 70, HUB.y + 120)}, ${x} ${endY}`
}

function smooth(points: { x: number; y: number }[]) {
  if (points.length < 2) return ''
  let d = `M${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`
  }
  return d
}

export function tunnelPath(org: Org, t: Tunnel) {
  const ch = Object.fromEntries(org.chambers.map((c) => [c.id, c]))
  const tg = org.targets.find((x) => x.id === t.target)!
  const first = ch[t.chambers[0]]
  const entry = { x: (CLOUD.x + first.x) / 2 + 20, y: 150 }
  const pts = [{ x: CLOUD.x, y: CLOUD.y + 22 }, entry, ...t.chambers.map((id) => ({ x: ch[id].x, y: ch[id].y })), { x: tg.x, y: tg.y - 10 }]
  return smooth(pts)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function TunnelMap({ org, run, digToken, fast, onEvent, selected, onSelect, impact, compact }: Props) {
  const [states, setStates] = useState<Record<string, ChamberState>>({})
  const [digging, setDigging] = useState<string | null>(null)
  const [shown, setShown] = useState<number>(run ? run.tunnels.length : 0)
  const [moleVisible, setMoleVisible] = useState(true)
  const moleRef = useRef<SVGGElement>(null)
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({})
  const runRef = useRef(0)

  useEffect(() => {
    placeMole(HUB.x, HUB.y)
  }, [])

  // Static view of a finished run.
  useEffect(() => {
    if (!run || digToken) return
    setStates(Object.fromEntries(run.chambers.map((c) => [c.chamber, c.status])))
    setShown(run.tunnels.length)
  }, [run, digToken])

  const placeMole = (x: number, y: number) => {
    moleRef.current?.setAttribute('transform', `translate(${x} ${y})`)
  }

  const travel = (path: SVGPathElement, ms: number, reverse = false) =>
    new Promise<void>((resolve) => {
      const L = path.getTotalLength()
      let t0: number | null = null
      const step = (now: number) => {
        if (t0 === null) t0 = now
        const k = Math.min(1, (now - t0) / ms)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        const p = path.getPointAtLength((reverse ? 1 - e : e) * L)
        placeMole(p.x, p.y)
        if (k < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })

  // Dig animation.
  useEffect(() => {
    if (!run || !digToken) return
    const my = ++runRef.current
    const alive = () => runRef.current === my
    const speed = fast ? 0.35 : 1
    ;(async () => {
      setShown(0)
      setStates(Object.fromEntries(org.chambers.map((c) => [c.id, 'pending' as ChamberState])))
      setMoleVisible(true)
      placeMole(HUB.x, HUB.y)
      onEvent?.({ kind: 'start', text: `Kret wchodzi pod ${org.name}: ${run.chambers.length} kabli do sprawdzenia.`, level: 'info' })
      await sleep(400 * speed)
      for (const c of run.chambers) {
        if (!alive()) return
        const path = pathRefs.current[c.chamber]
        onEvent?.({ kind: 'dig', chamber: c.chamber, text: `${c.label}: ${c.dig}…` })
        setDigging(c.chamber)
        if (path) await travel(path, 850 * speed)
        if (!alive()) return
        setStates((s) => ({ ...s, [c.chamber]: 'checking' }))
        await sleep(550 * speed)
        if (!alive()) return
        setStates((s) => ({ ...s, [c.chamber]: c.status }))
        for (const it of c.items) onEvent?.({ kind: 'result', chamber: c.chamber, level: it.level, text: `${c.label}: ${it.text}` })
        setDigging(null)
        if (path) await travel(path, 380 * speed, true)
      }
      placeMole(HUB.x, HUB.y)
      for (let i = 0; i < run.tunnels.length; i++) {
        if (!alive()) return
        await sleep(650 * speed)
        const t = run.tunnels[i]
        setShown(i + 1)
        onEvent?.({ kind: 'tunnel', level: t.state === 'open' ? 'bad' : 'warn', text: `Tunel ${t.n}: internet → ${t.steps.map((s) => s.to_label.toLowerCase()).join(' → ')}` })
      }
      await sleep(300 * speed)
      onEvent?.({ kind: 'done', text: run.summary, level: 'info' })
    })()
    return () => {
      runRef.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digToken])

  const fixedChambers = useMemo(
    () => new Set(run?.chambers.filter((c) => c.items.some((i) => i.source === 'fixed')).map((c) => c.chamber) ?? []),
    [run],
  )
  const hitTargets = new Set(run?.tunnels.slice(0, shown).map((t) => t.target) ?? [])
  const visibleTunnels = run?.tunnels.slice(0, shown) ?? []
  const active = impact ? null : selected ?? visibleTunnels[visibleTunnels.length - 1]?.id ?? null
  // In incident mode every tunnel that runs through an untrusted chamber is lit, the rest fade.
  const lit = (t: Tunnel) => (impact ? t.chambers.some((c) => impact.untrusted.includes(c)) : active === t.id)

  return (
    <svg className={`tmap ${compact ? 'tmap-compact' : ''}`} viewBox="0 0 1000 640" role="img"
      aria-label={`Przekrój biura ${org.name}: kable sieciowe pod podłogą prowadzą do ${org.chambers.length} miejsc, które sprawdza kret.`}>
      <defs>
        <linearGradient id="tm-room" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#191c22" />
          <stop offset="1" stopColor="#1f232b" />
        </linearGradient>
        <pattern id="tm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#1b1f26" strokeWidth="1" />
        </pattern>
        <pattern id="tm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="8" fill="rgba(255,97,89,.18)" />
        </pattern>
        <filter id="tm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* room above the floor */}
      <rect x="0" y="0" width="1000" height="140" fill="url(#tm-room)" />
      <rect x="0" y="140" width="1000" height="500" fill="#0d0f13" />
      <rect x="0" y="140" width="1000" height="500" fill="url(#tm-grid)" />

      {/* internet cloud + uplink */}
      <g className="tm-cloud" color="#8e97a8">
        <IconG name="cloud" x={CLOUD.x} y={CLOUD.y} size={58} stroke={1.4} />
        <text x={CLOUD.x} y={CLOUD.y + 46} textAnchor="middle" className="tm-small">Internet</text>
      </g>
      {org.chambers.find((c) => c.id === 'siec') && (() => {
        const r = org.chambers.find((c) => c.id === 'siec')!
        const d = `M${CLOUD.x} ${CLOUD.y + 56} C ${CLOUD.x} 150, ${r.x} 150, ${r.x} ${r.y - 36}`
        return (
          <g>
            <path d={d} className="cable-sheath" />
            <path d={d} className="cable-core wan" />
          </g>
        )
      })()}

      {/* office furniture */}
      <g className="tm-office">
        <text x="500" y="26" textAnchor="middle" className="tm-sign">{org.name}</text>
        {[250, 760].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <rect x="-70" y="96" width="140" height="8" rx="2" fill="#2a2f39" />
            <rect x="-62" y="104" width="6" height="36" fill="#2a2f39" />
            <rect x="56" y="104" width="6" height="36" fill="#2a2f39" />
            <rect x="-30" y="56" width="60" height="38" rx="3" fill="#232831" stroke="#3a414f" />
            <rect x="-26" y="60" width="52" height="30" rx="2" className="tm-screen" />
            <rect x="-4" y="94" width="8" height="4" fill="#3a414f" />
          </g>
        ))}
        <g transform="translate(470 44)">
          <rect width="60" height="96" rx="4" fill="#1d2129" stroke="#3a414f" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(6 ${8 + i * 21})`}>
              <rect width="48" height="15" rx="2" fill="#262b34" />
              <circle cx="7" cy="7.5" r="2" className={`tm-led led-${i}`} />
              <circle cx="14" cy="7.5" r="2" className={`tm-led led-${(i + 2) % 4}`} />
            </g>
          ))}
        </g>
        <path d={`M500 140 V${HUB.y}`} className="cable-sheath" />
        <path d={`M500 140 V${HUB.y}`} className="cable-core" />
      </g>

      {/* raised floor */}
      <rect x="0" y="136" width="1000" height="8" fill="#2a2f39" />
      {Array.from({ length: 25 }, (_, i) => (
        <rect key={i} x={i * 40 + 1} y="137" width="38" height="6" rx="1" fill="#323844" />
      ))}
      <text x="16" y="168" className="tm-small">Pod podłogą: kable sieciowe</text>

      {/* cables to chambers */}
      {org.chambers.map((c) => {
        const st = states[c.id] ?? 'idle'
        return (
          <g key={c.id} className={`cable st-${st} ${digging === c.id ? 'digging' : ''}`}>
            <path d={cablePath(c.x, c.y)} className="cable-sheath" />
            <path ref={(el) => { pathRefs.current[c.id] = el }} d={cablePath(c.x, c.y)} className="cable-core" />
            <path d={cablePath(c.x, c.y)} className="cable-pulse" />
          </g>
        )
      })}

      {/* patch panel */}
      <g transform={`translate(${HUB.x} ${HUB.y})`}>
        <rect x="-74" y="-14" width="148" height="28" rx="5" fill="#1d2129" stroke="#4a5262" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-66 + i * 11.2} y="-6" width="8" height="8" rx="1.5" fill="#0d0f13" stroke="#3a414f" />
        ))}
        <text x="0" y="30" textAnchor="middle" className="tm-small">Patch panel</text>
      </g>

      {/* targets */}
      <text x="16" y="548" className="tm-small">To, co boli</text>
      {org.targets.map((t) => {
        const hit = hitTargets.has(t.id) || impact?.at_risk.includes(t.id)
        return (
          <g key={t.id} transform={`translate(${t.x} ${t.y})`} className={`tm-target ${hit ? 'hit' : 'safe'}`}>
            <rect x="-92" y="-28" width="184" height="56" rx="12" />
            <g color={hit ? 'var(--bad)' : 'var(--muted)'}><IconG name={TARGET_ICON[t.id] ?? 'shield'} x={-62} y={0} size={24} /></g>
            <text x="-38" y="-2" className="tm-target-name">{t.label}</text>
            <text x="-38" y="15" className="tm-small">{hit ? 'w zasięgu ataku' : run ? 'bezpieczne' : ''}</text>
          </g>
        )
      })}

      {/* attack tunnels */}
      <g className="tunnels">
        {[...visibleTunnels].sort((a, b) => Number(lit(a)) - Number(lit(b))).map((t) => {
          const d = tunnelPath(org, t)
          const isSel = lit(t)
          const dim = !isSel
          return (
            <g key={t.id} className={`tunnel ${t.state} ${isSel ? 'sel' : ''} ${dim ? 'dim' : ''}`}
              onClick={() => onSelect?.(t.id)}>
              <path d={d} className="tunnel-glow" filter="url(#tm-glow)" />
              <path d={d} className="tunnel-line" pathLength={1} />
              <path d={d} className="tunnel-flow" />
              <path d={d} className="tunnel-hit" />
            </g>
          )
        })}
      </g>

      {/* chambers */}
      {org.chambers.map((c) => {
        const st = states[c.id] ?? 'idle'
        const untrusted = impact?.untrusted.includes(c.id)
        return (
          <g key={c.id} transform={`translate(${c.x} ${c.y})`} className={`chamber st-${st} ${untrusted ? 'untrusted' : ''}`}>
            <circle r="52" className="chamber-glow" />
            <rect x="-34" y="-34" width="68" height="68" rx="16" className="chamber-box" />
            {untrusted && <rect x="-34" y="-34" width="68" height="68" rx="16" fill="url(#tm-hatch)" />}
            <g className="chamber-icon"><IconG name={c.icon} x={0} y={0} size={30} /></g>
            <text y="54" textAnchor="middle" className="chamber-name">{c.label}</text>
            <text y="71" textAnchor="middle" className="chamber-st">{untrusted ? 'niezaufane' : STATUS_TEXT[st]}</text>
            {fixedChambers.has(c.id) && st !== 'pending' && st !== 'checking' && (
              <text y="-44" textAnchor="middle" className="tm-zip">zasypane</text>
            )}
          </g>
        )
      })}

      {/* mole */}
      <g ref={moleRef} className={`tm-kret ${digging ? 'digging' : ''}`} style={{ opacity: moleVisible ? 1 : 0 }}>
        <circle r="24" className="tm-kret-glow" />
        <circle r="11" className="tm-kret-ring" />
        <circle r="6" className="tm-kret-core" />
        <circle cx="-1.6" cy="-1.6" r="2.2" fill="#fff8e6" />
      </g>
    </svg>
  )
}
