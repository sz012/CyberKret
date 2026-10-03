import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconG } from '../../components/icons'
import {
  P,
  RIG_BODY,
  RIG_FEET,
  RIG_LAMP,
  RIG_NECK,
  bump,
  clamp,
  ease,
  frame,
  legProgress,
  mix,
  mixBox,
  rotateAround,
  schedule,
  span,
  toward,
  track,
  wave,
  type Box,
  type Pt,
} from './geometry'
import { MoleRig } from './MoleRig'

const END = 16800
const FLOOR = 470
const PORT_X = 820
const HINGE_X = 772

const INTRUDER = track([
  [P(-700, 560), P(-500, 560), P(-260, 560), P(-60, 560)],
  [P(-60, 560), P(120, 560), P(220, 604), P(380, 604)],
  [P(380, 604), P(520, 604), P(560, 548), P(700, 552)],
  [P(700, 552), P(790, 554), P(822, 566), P(PORT_X, FLOOR + 10)],
])

const AMBIENT = [
  track([[P(-700, 522), P(0, 516), P(700, 540), P(1900, 512)]]),
  track([[P(-700, 652), P(200, 664), P(900, 628), P(1900, 662)]]),
]

const SWITCH = P(600, 650)
const INTERNET = P(60, 520)
const TARGET = P(600, 965)

type Status = 'bad' | 'ok' | 'warn'

const NODES: { id: string; label: string; icon: string; p: Pt; status: Status; verdict: string; side?: 'left' | 'right' }[] = [
  { id: 'siec', label: 'Sieć i router', icon: 'router', p: P(170, 770), status: 'bad', verdict: 'pulpit zdalny otwarty', side: 'left' },
  { id: 'komputery', label: 'Komputery', icon: 'laptop', p: P(370, 830), status: 'ok', verdict: 'w porządku' },
  { id: 'konta', label: 'Konta i hasła', icon: 'key', p: P(600, 870), status: 'bad', verdict: 'admin bez MFA', side: 'right' },
  { id: 'poczta', label: 'Poczta', icon: 'mail', p: P(830, 830), status: 'warn', verdict: 'brak DMARC' },
  { id: 'kopie', label: 'Kopie zapasowe', icon: 'disk', p: P(1040, 770), status: 'ok', verdict: 'w porządku' },
]

const ROUTE = track([
  [P(PORT_X, FLOOR + 10), P(PORT_X, 560), P(700, 630), SWITCH],
  [SWITCH, P(470, 690), P(220, 690), NODES[0].p],
  [NODES[0].p, P(240, 820), P(300, 830), NODES[1].p],
  [NODES[1].p, P(450, 830), P(520, 870), NODES[2].p],
  [NODES[2].p, P(680, 870), P(750, 830), NODES[3].p],
  [NODES[3].p, P(910, 830), P(980, 800), NODES[4].p],
])

const BUS = track([
  [NODES[0].p, P(240, 820), P(300, 830), NODES[1].p],
  [NODES[1].p, P(450, 830), P(520, 870), NODES[2].p],
  [NODES[2].p, P(680, 870), P(750, 830), NODES[3].p],
  [NODES[3].p, P(910, 830), P(980, 800), NODES[4].p],
])
const DROP = track([[P(PORT_X, FLOOR + 10), P(PORT_X, 560), P(700, 630), SWITCH]])
const FEED = track([[SWITCH, P(470, 690), P(220, 690), NODES[0].p]])
const UPLINK = track([[P(INTERNET.x, INTERNET.y + 24), P(60, 640), P(120, 730), NODES[0].p]])

const TUNNEL = track([
  [P(INTERNET.x, INTERNET.y + 24), P(60, 640), P(120, 730), NODES[0].p],
  [NODES[0].p, P(250, 1010), P(470, 1010), NODES[2].p],
  [NODES[2].p, P(612, 892), P(612, 918), P(TARGET.x, TARGET.y - 26)],
])

const LEGS = schedule(11800, [600, 560, 420, 420, 420, 420], [100, 220, 220, 220, 220, 0])
const ARRIVALS = NODES.map((_, i) => LEGS[i + 1].end)
const LEG_DIRECTION = [-1, -1, 1, 1, 1, 1]

const T = {
  blip: [1700, 3100, 3350, 5000],
  alarm: [5000, 7000, 7500],
  monitorAlert: 2600,
  monitorOk: 8200,
  lid: 6800,
  rise: [6950, 7800],
  turn: [8500, 8680],
  happy: 9100,
  wave: [9150, 10150],
  dive: [10300, 10470, 10850],
  lidClose: [10900, 11150],
  net: [11000, 11600],
  tunnel: [15700, 16500],
}

const SHOTS: { t: number; wide: Box; narrow: Box }[] = [
  { t: 0, wide: [-40, 30, 1260, 690], narrow: [430, 70, 780, 640] },
  { t: 4300, wide: [-40, 30, 1260, 690], narrow: [430, 70, 780, 640] },
  { t: 5300, wide: [250, 110, 980, 590], narrow: [520, 130, 680, 560] },
  { t: 6800, wide: [300, 120, 930, 560], narrow: [540, 140, 660, 540] },
  { t: 7500, wide: [430, 140, 790, 500], narrow: [560, 160, 620, 480] },
  { t: 8300, wide: [430, 140, 790, 500], narrow: [560, 160, 620, 480] },
  { t: 8800, wide: [120, 90, 1090, 590], narrow: [380, 100, 840, 600] },
  { t: 9150, wide: [120, 90, 1090, 590], narrow: [380, 100, 840, 600] },
  { t: 9650, wide: [470, 150, 760, 470], narrow: [560, 160, 600, 470] },
  { t: 10400, wide: [470, 150, 760, 470], narrow: [560, 160, 600, 470] },
  { t: 11900, wide: [-40, 420, 1260, 830], narrow: [0, 430, 1200, 800] },
]

function camera(t: number, aspect: number): Box {
  const narrow = aspect < 0.95
  let box = narrow ? SHOTS[0].narrow : SHOTS[0].wide
  for (let i = 1; i < SHOTS.length; i++) {
    const a = SHOTS[i - 1]
    const b = SHOTS[i]
    if (t >= b.t) {
      box = narrow ? b.narrow : b.wide
      continue
    }
    const k = span(t, a.t, b.t)
    box = mixBox(narrow ? a.narrow : a.wide, narrow ? b.narrow : b.wide, k)
    break
  }
  return frame(box, aspect)
}

function blipProgress(t: number): number {
  const [start, junction, leave, port] = T.blip
  const from = INTRUDER.ends[0]
  const mid = INTRUDER.ends[1]
  if (t < junction) return mix(from, mid, span(t, start, junction, ease.out))
  if (t < leave) return mid + 0.004 * Math.sin((t - junction) / 40)
  return mix(mid, 1, span(t, leave, port, ease.inOut))
}

function alarmLevel(t: number): number {
  const [start, hold, end] = T.alarm
  return span(t, start, start + 400) * (1 - span(t, hold, end))
}

interface MoleState {
  visible: boolean
  feet: Pt
  facing: number
  squash: number
  tilt: number
  blink: number
  happy: boolean
  waving: number | null
  beam: number
}

function moleState(t: number): MoleState {
  const visible = t >= T.rise[0] && t < T.dive[2]
  const rise = span(t, T.rise[0], T.rise[1], ease.back)
  let y = mix(FLOOR + 230, FLOOR, rise)
  if (t >= T.dive[0]) {
    const hop = span(t, T.dive[0], T.dive[1], ease.out)
    const fall = span(t, T.dive[1], T.dive[2], ease.in)
    y = FLOOR - 24 * hop * (1 - fall) + 240 * fall
  }
  const squash = 1 - 0.08 * bump(t, T.rise[1] - 80, T.rise[1] + 260) + 0.05 * bump(t, T.dive[0] - 120, T.dive[0] + 60)
  const turn = span(t, T.turn[0], T.turn[1])
  const facing = Math.cos(Math.PI * turn)
  let beam = -55
  if (t < T.turn[0]) beam = mix(-55, -18, span(t, 7950, 8450))
  else beam = mix(-30, -8, wave(t - T.turn[1], 2600))
  const tilt = clamp((beam + 25) * 0.4, -10, 8)
  const blink = Math.max(bump(t, 8380, 8500), bump(t, 9900, 10020))
  const happy = t >= T.happy && t < T.dive[0]
  const waving = t >= T.wave[0] && t < T.wave[1] ? (t - T.wave[0]) / 95 : null
  return { visible, feet: P(PORT_X - 6, y), facing, squash, tilt, blink, happy, waving, beam }
}

function lampPosition(feet: Pt, scaleX: number, scaleY: number, tilt: number): Pt {
  const lamp = rotateAround(RIG_LAMP, RIG_NECK, tilt)
  return P(feet.x + scaleX * (lamp.x - RIG_FEET.x), feet.y + scaleY * (lamp.y - RIG_FEET.y))
}

const Room = memo(function Room() {
  return (
    <g>
      <rect x="-1600" y="-1600" width="4400" height={1600 + FLOOR} fill="url(#kf-wall)" />
      <g transform="translate(905 74)">
        <rect width="250" height="230" rx="4" fill="url(#kf-glass)" stroke="#262b34" strokeWidth="7" />
        <path d="M125 0v230M0 118h250" stroke="#262b34" strokeWidth="5" />
        <circle cx="196" cy="54" r="20" fill="#e9e3cf" opacity="0.82" />
        <circle cx="188" cy="48" r="20" fill="#101722" />
        <g fill="#1b222d">
          <rect x="10" y="168" width="34" height="58" />
          <rect x="50" y="150" width="28" height="76" />
          <rect x="84" y="178" width="38" height="48" />
          <rect x="132" y="158" width="30" height="68" />
          <rect x="168" y="182" width="36" height="44" />
          <rect x="210" y="164" width="34" height="62" />
        </g>
        <g fill="#ffd479">
          <rect className="kf-city kf-city-1" x="18" y="180" width="5" height="5" />
          <rect className="kf-city kf-city-2" x="58" y="166" width="5" height="5" />
          <rect className="kf-city kf-city-3" x="142" y="172" width="5" height="5" />
          <rect className="kf-city kf-city-2" x="220" y="178" width="5" height="5" />
          <rect className="kf-city kf-city-1" x="92" y="192" width="5" height="5" />
        </g>
      </g>
      <g transform="translate(850 168)">
        <circle r="30" fill="#171a20" stroke="#2c323d" strokeWidth="4" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="0" y1="-23" x2="0" y2={i % 3 ? -20.5 : -18} stroke="#4a5262" strokeWidth="2" transform={`rotate(${i * 30})`} />
        ))}
        <line x1="0" y1="0" x2="0" y2="-13" stroke="#8e97a8" strokeWidth="3.5" strokeLinecap="round" transform="rotate(353)" />
        <line x1="0" y1="0" x2="0" y2="-20" stroke="#c9ced8" strokeWidth="2.5" strokeLinecap="round" transform="rotate(282)" />
        <circle r="2.5" fill="#c9ced8" />
      </g>
      <g transform="translate(70 268)">
        <rect width="270" height="202" fill="#15181e" stroke="#232831" strokeWidth="4" />
        {[0, 1].map((row) => (
          <g key={row} transform={`translate(0 ${row * 100})`}>
            <rect x="0" y="94" width="270" height="8" fill="#232831" />
            {Array.from({ length: 9 }, (_, i) => {
              const h = 64 + ((i * 37 + row * 17) % 22)
              const shade = ['#2a3140', '#30364a', '#3b3428', '#2d3a36', '#373041'][(i + row * 2) % 5]
              return (
                <g key={i} transform={`translate(${12 + i * 28} ${94 - h})`}>
                  <rect width="22" height={h} rx="2" fill={shade} />
                  <rect x="5" y="12" width="12" height="16" rx="1.5" fill="#cfc8b8" opacity="0.18" />
                </g>
              )
            })}
          </g>
        ))}
      </g>
      <g transform="translate(400 0)">
        <rect x="-26" y="408" width="52" height="62" rx="6" fill="#262b34" />
        <path d="M0 408 C -24 360, -46 356, -56 334 M0 408 C 6 350, 16 330, 26 308 M0 408 C 26 378, 56 368, 66 346" stroke="#2c5139" strokeWidth="8" strokeLinecap="round" fill="none" />
      </g>
      <g>
        <rect x="560" y="356" width="320" height="13" rx="3" fill="#232831" />
        <rect x="576" y="369" width="11" height={FLOOR - 369} fill="#1d2129" />
        <rect x="852" y="369" width="11" height={FLOOR - 369} fill="#1d2129" />
        <rect x="628" y="258" width="164" height="98" rx="7" fill="#1a1e25" stroke="#323844" strokeWidth="3" />
        <rect x="700" y="356" width="20" height="2" fill="#323844" />
        <rect x="688" y="346" width="44" height="10" rx="2" fill="#2a2f39" />
        <rect x="604" y="344" width="60" height="10" rx="2" fill="#2a2f39" />
        <rect x="812" y="330" width="22" height="26" rx="4" fill="#2f3542" />
        <path d="M834 336 q10 4 0 14" fill="none" stroke="#2f3542" strokeWidth="4" />
      </g>
      <rect x="-1600" y={FLOOR - 6} width="4400" height="14" fill="#232831" />
      {Array.from({ length: 44 }, (_, i) => (
        <rect key={i} x={-1600 + i * 100 + 1} y={FLOOR - 5} width="98" height="11" rx="1" fill="#2c323d" />
      ))}
      <rect x="-1600" y={FLOOR + 8} width="4400" height="2400" fill="#0a0c0f" />
      <rect x="-1600" y={FLOOR + 8} width="4400" height="2400" fill="url(#kf-grid)" />
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={-1000 + i * 150} y={FLOOR + 8} width="6" height="1200" fill="#101318" />
      ))}
      <g fill="none" strokeLinecap="round">
        {AMBIENT.map((cable, i) => (
          <path key={i} d={cable.d} stroke="#22272f" strokeWidth="12" />
        ))}
        <path d={INTRUDER.d} stroke="#1e3354" strokeWidth="13" />
        <path d={INTRUDER.d} stroke="#2d4a77" strokeWidth="7" />
      </g>
    </g>
  )
})

function Monitor({ t }: { t: number }) {
  const alert = span(t, T.monitorAlert, T.monitorAlert + 300) * (1 - span(t, T.monitorOk - 200, T.monitorOk))
  const ok = span(t, T.monitorOk - 200, T.monitorOk + 200)
  const standby = 1 - Math.max(alert, ok)
  return (
    <g>
      <rect x="636" y="266" width="148" height="82" rx="3" fill="#0e1217" />
      <rect x="636" y="266" width="148" height="82" rx="3" fill="#3a1414" opacity={alert * (0.75 + 0.25 * wave(t, 700))} />
      <rect x="636" y="266" width="148" height="82" rx="3" fill="#123020" opacity={ok} />
      <circle cx="776" cy="342" r="2.2" fill="#5fd08a" opacity={standby * (0.35 + 0.65 * wave(t, 1600))} />
      <g opacity={alert}>
        <path d="M710 280 l12 21 h-24 z" fill="none" stroke="#ff6159" strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M710 288 v6 M710 297.5 v.5" stroke="#ff6159" strokeWidth="2.6" strokeLinecap="round" />
        <text x="710" y="322" textAnchor="middle" className="kf-screen">Nieznany ruch</text>
        <text x="710" y="336" textAnchor="middle" className="kf-screen">w sieci</text>
      </g>
      <g opacity={ok}>
        <path d="M694 294 l10 10 l20 -22" fill="none" stroke="#5fd08a" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="710" y="328" textAnchor="middle" className="kf-screen ok">Kret sprawdza</text>
      </g>
      <rect x="560" y="356" width="320" height="13" fill={alert ? '#ff6159' : '#5fd08a'} opacity={0.05 * Math.max(alert, ok)} />
    </g>
  )
}

function Port({ t, alarm }: { t: number; alarm: number }) {
  const open = span(t, T.lid, T.lid + 320, ease.back)
  const close = span(t, T.lidClose[0], T.lidClose[1], ease.out)
  const rattle = t < T.lid ? alarm * 3.2 * Math.sin(t / 19) : 0
  const angle = -168 * open * (1 - close) + rattle
  const lift = t < T.lid ? -alarm * 1.6 * Math.abs(Math.sin(t / 23)) : 0
  return (
    <g>
      <rect x={HINGE_X + 2} y={FLOOR - 4} width="92" height="11" rx="2" fill="#050608" />
      <g transform={`translate(${HINGE_X} ${FLOOR - 6 + lift}) rotate(${angle})`}>
        <rect x="0" y="-4" width="96" height="10" rx="3" fill="#3a414f" />
        <rect x="34" y="-2" width="28" height="4" rx="2" fill="#5b6271" />
      </g>
    </g>
  )
}

function PortLight({ t }: { t: number }) {
  const burst = span(t, T.lid, T.lid + 140, ease.out) * (1 - span(t, T.lid + 200, T.rise[1] + 300))
  const residual = 0.22 * span(t, T.lid, T.lid + 300) * (1 - span(t, T.dive[1], T.lidClose[1]))
  const opacity = Math.max(burst * 0.95, residual)
  if (opacity <= 0.001) return null
  return (
    <g opacity={opacity}>
      <polygon points={`${HINGE_X + 4},${FLOOR} ${HINGE_X + 92},${FLOOR} 1010,-40 600,-40`} fill="url(#kf-shaft)" />
    </g>
  )
}

function Dust({ t }: { t: number }) {
  const k = (t - T.lid) / 1100
  if (k <= 0 || k >= 1) return null
  return (
    <g fill="#c9b98f">
      {Array.from({ length: 14 }, (_, i) => {
        const angle = ((-150 + i * 9 + ((i * 53) % 17)) * Math.PI) / 180
        const speed = 70 + ((i * 37) % 60)
        const x = PORT_X + Math.cos(angle) * speed * k
        const y = FLOOR + Math.sin(angle) * speed * k + 90 * k * k
        return <circle key={i} cx={x} cy={y} r={1.2 + (i % 3) * 0.6} opacity={(1 - k) * 0.8} />
      })}
    </g>
  )
}

function Beam({ from, angle, length, spread, opacity, id }: { from: Pt; angle: number; length: number; spread: number; opacity: number; id: string }) {
  if (opacity <= 0.01) return null
  const a = toward(from, angle - spread, length)
  const b = toward(from, angle + spread, length)
  const end = toward(from, angle, length)
  return (
    <g className="kf-beam" opacity={opacity}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={from.x} y1={from.y} x2={end.x} y2={end.y}>
          <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.62" />
          <stop offset="0.55" stopColor="#ffd479" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${from.x},${from.y} ${a.x},${a.y} ${b.x},${b.y}`} fill={`url(#${id})`} />
    </g>
  )
}

function Network({ t }: { t: number }) {
  const shown = span(t, T.net[0], T.net[1])
  if (shown <= 0) return null
  const tunnel = span(t, T.tunnel[0], T.tunnel[1])
  const hit = t >= T.tunnel[1]
  return (
    <g opacity={shown}>
      <g fill="none" strokeLinecap="round">
        {[UPLINK, DROP, FEED, BUS].map((cable, i) => (
          <g key={i}>
            <path d={cable.d} stroke="#1e3354" strokeWidth="11" />
            <path d={cable.d} stroke="#2d4a77" strokeWidth="5" />
          </g>
        ))}
      </g>
      <g transform={`translate(${INTERNET.x} ${INTERNET.y})`} className="kf-node-label">
        <circle r="24" fill="#15181d" stroke="#3c4352" strokeWidth="2" />
        <g color="#c9ced8">
          <IconG name="cloud" x={0} y={0} size={26} />
        </g>
        <text x="34" y="5" className="kf-label">Internet</text>
      </g>
      <g transform={`translate(${SWITCH.x} ${SWITCH.y})`}>
        <rect x="-50" y="-15" width="100" height="30" rx="5" fill="#1a1e25" stroke="#3c4352" strokeWidth="2" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={-38 + i * 13} y="-4" width="8" height="8" rx="1.5" fill="#5fd08a" opacity={0.35 + 0.65 * wave(t + i * 170, 900)} />
        ))}
      </g>
      {NODES.map((node, i) => {
        const arrived = t >= ARRIVALS[i]
        const pop = 1 + 0.16 * bump(t, ARRIVALS[i], ARRIVALS[i] + 320)
        const color = !arrived ? '#3c4352' : node.status === 'bad' ? '#ff6159' : node.status === 'warn' ? '#f2c14e' : '#5fd08a'
        return (
          <g key={node.id} transform={`translate(${node.p.x} ${node.p.y})`}>
            {arrived && <circle r={44} fill={color} opacity={0.12} />}
            <g transform={`scale(${pop})`}>
              <circle r="27" fill="#15181d" stroke={color} strokeWidth="3" />
              <g color={arrived ? '#eef0f3' : '#8e97a8'}>
                <IconG name={node.icon} x={0} y={0} size={24} />
              </g>
            </g>
            <text x={node.side === 'left' ? -42 : node.side === 'right' ? 42 : 0} y={node.side ? -2 : 52} textAnchor={node.side === 'left' ? 'end' : node.side === 'right' ? 'start' : 'middle'} className="kf-label">{node.label}</text>
            <text x={node.side === 'left' ? -42 : node.side === 'right' ? 42 : 0} y={node.side ? 16 : 70} textAnchor={node.side === 'left' ? 'end' : node.side === 'right' ? 'start' : 'middle'} className="kf-verdict" fill={arrived ? color : '#8e97a8'}>
              {arrived ? node.verdict : 'czeka na kreta'}
            </text>
          </g>
        )
      })}
      <g transform={`translate(${TARGET.x} ${TARGET.y})`}>
        {hit && <rect x="-52" y="-40" width="104" height="80" rx="12" fill="#ff6159" opacity={0.14} />}
        <rect x="-34" y="-25" width="68" height="50" rx="7" fill="#15181d" stroke={hit ? '#ff6159' : '#3c4352'} strokeWidth="3" />
        <g color={hit ? '#ffb4ae' : '#c9ced8'}>
          <IconG name="folder" x={0} y={0} size={26} />
        </g>
        <text x="48" y="-2" className="kf-label">Akta klientów</text>
        <text x="48" y="16" className="kf-verdict" fill={hit ? '#ff6159' : '#8e97a8'}>{hit ? 'w zasięgu włamywacza' : 'bezpieczne?'}</text>
      </g>
      {tunnel > 0 && (
        <g fill="none" strokeLinecap="round">
          <path d={TUNNEL.d} stroke="#ff6159" strokeWidth="14" opacity="0.18" strokeDasharray={TUNNEL.length} strokeDashoffset={TUNNEL.length * (1 - tunnel)} />
          <path d={TUNNEL.d} stroke="#ff6159" strokeWidth="3.5" strokeDasharray={TUNNEL.length} strokeDashoffset={TUNNEL.length * (1 - tunnel)} />
          {hit && <path d={TUNNEL.d} stroke="#ffd2cf" strokeWidth="2" strokeDasharray="3 15" strokeDashoffset={-t / 30} />}
        </g>
      )}
    </g>
  )
}

function Scout({ t }: { t: number }) {
  if (t < LEGS[0].start - 100) return null
  const u = legProgress(t, LEGS, ROUTE.ends)
  const p = ROUTE.at(u)
  let leg = LEGS.findIndex((l) => t <= l.end)
  if (leg === -1) leg = LEGS.length
  const done = t > LEGS[LEGS.length - 1].end
  const facing = done ? -1 : LEG_DIRECTION[Math.min(leg, LEG_DIRECTION.length - 1)]
  const s = 0.34
  const bob = done ? 0 : 3 * Math.sin(t / 70)
  const feet = P(p.x - facing * s * (RIG_BODY.x - RIG_FEET.x), p.y + bob - s * (RIG_BODY.y - RIG_FEET.y))
  const lamp = lampPosition(feet, facing * s, s, 0)
  const angle = facing > 0 ? -6 : 186
  return (
    <g>
      <Beam id="kf-scout-beam" from={lamp} angle={angle} length={150} spread={13} opacity={0.9} />
      <g transform={`translate(${feet.x} ${feet.y}) scale(${facing * s} ${s}) translate(${-RIG_FEET.x} ${-RIG_FEET.y})`}>
        <MoleRig id="kf-scout" lamp={1} badge={false} />
      </g>
    </g>
  )
}

const CAPTIONS: { key: string; from: number; to: number }[] = [
  { key: 'night', from: 250, to: 1900 },
  { key: 'motion', from: 1900, to: 5000 },
  { key: 'alarm', from: 5000, to: 7300 },
  { key: 'calm', from: 7300, to: 10700 },
  { key: 'purpose', from: 11900, to: Infinity },
]

export default function KretFilm() {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [t, setT] = useState(reduce ? END : 0)
  const [aspect, setAspect] = useState(16 / 9)
  const raf = useRef(0)
  const stage = useRef<HTMLElement>(null)

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current)
    const started = performance.now()
    const tick = (now: number) => {
      const value = Math.min(END, now - started)
      setT(value)
      if (value < END) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (!reduce) play()
    return () => cancelAnimationFrame(raf.current)
  }, [play, reduce])

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setAspect(width / height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const skip = () => {
    cancelAnimationFrame(raf.current)
    setT(END)
  }

  const alarm = alarmLevel(t)
  const [vx, vy, vw, vh] = camera(t, aspect)
  const shakeX = alarm * 2.2 * Math.sin(t / 37)
  const shakeY = alarm * 1.6 * Math.cos(t / 29)

  const mole = moleState(t)
  const scaleX = mole.facing / mole.squash
  const scaleY = mole.squash
  const lamp = lampPosition(mole.feet, scaleX, scaleY, mole.tilt)
  const beamAngle = mole.facing >= 0 ? mole.beam : 180 - mole.beam
  const beamOpacity = mole.visible ? clamp(Math.abs(mole.facing) * 1.4) * span(t, T.lid + 60, T.lid + 260) : 0
  const glow = mole.visible ? span(t, T.lid, T.lid + 400) : 0

  const u = blipProgress(t)
  const blip = INTRUDER.at(u)
  const blipOpacity = span(t, T.blip[0], T.blip[0] + 250) * (1 - span(t, T.blip[3] - 150, T.blip[3] + 150))
  const trail = 190
  const ambient = 1 - span(t, T.blip[0], T.blip[0] + 600)

  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to)
  const ended = t >= END

  return (
    <section ref={stage} className="kf" aria-label="Animacja: nocą w biurze coś porusza się w kablach. To kret, który sprawdza sieć i pokazuje drogę włamywacza.">
      <svg className="kf-svg" viewBox={`${vx + shakeX} ${vy + shakeY} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="kf-wall" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#090b0e" />
            <stop offset="0.75" stopColor="#11141a" />
            <stop offset="1" stopColor="#151820" />
          </linearGradient>
          <linearGradient id="kf-glass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0c1420" />
            <stop offset="1" stopColor="#142033" />
          </linearGradient>
          <linearGradient id="kf-shaft" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.85" />
            <stop offset="0.6" stopColor="#ffd479" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="kf-room-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd479" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kf-blip" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6dc" />
            <stop offset="0.35" stopColor="#ffd479" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="kf-vignette" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.7" />
          </radialGradient>
          <pattern id="kf-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="#12161c" />
          </pattern>
          <clipPath id="kf-above">
            <rect x="-1600" y="-1600" width="4400" height={1600 + FLOOR + 1} />
          </clipPath>
        </defs>

        <Room />

        <g fill="none" strokeLinecap="round">
          {AMBIENT.map((cable, i) =>
            ambient > 0.01
              ? [0.12, 0.45, 0.78].map((offset) => {
                  const p = cable.at((offset + t / (26000 + i * 7000)) % 1)
                  return <circle key={`${i}-${offset}`} cx={p.x} cy={p.y} r="2.6" fill="#6ea8ff" opacity={0.55 * ambient} />
                })
              : null,
          )}
          {blipOpacity > 0 && (
            <path
              d={INTRUDER.d}
              stroke="#ffd479"
              strokeWidth="4"
              opacity={0.65 * blipOpacity}
              strokeDasharray={`${trail} ${INTRUDER.length}`}
              strokeDashoffset={-(u * INTRUDER.length - trail)}
            />
          )}
        </g>
        {blipOpacity > 0 && (
          <g opacity={blipOpacity}>
            {[1, 2, 3, 4, 5].map((k) => {
              const p = INTRUDER.at(u - k * 0.006)
              return <circle key={k} cx={p.x} cy={p.y} r={10 - k * 1.4} fill="#ffd479" opacity={0.28 - k * 0.045} />
            })}
            <circle cx={blip.x} cy={blip.y} r="36" fill="url(#kf-blip)" />
            <circle cx={blip.x} cy={blip.y} r="6.5" fill="#fff6dc" />
          </g>
        )}

        <Network t={t} />
        <Scout t={t} />

        <Monitor t={t} />
        <PortLight t={t} />
        {glow > 0 && <circle cx={lamp.x} cy={lamp.y} r="420" fill="url(#kf-room-glow)" opacity={glow} />}
        {mole.visible && (
          <ellipse cx={mole.feet.x} cy={FLOOR + 2} rx="190" ry="16" fill="#ffd479" opacity={0.1 * glow} />
        )}
        <Beam id="kf-beam" from={lamp} angle={beamAngle} length={720} spread={15} opacity={beamOpacity} />
        <g clipPath="url(#kf-above)">
          {mole.visible && (
            <g transform={`translate(${mole.feet.x} ${mole.feet.y}) scale(${scaleX} ${scaleY}) translate(${-RIG_FEET.x} ${-RIG_FEET.y})`}>
              <MoleRig id="kf-mole" tilt={mole.tilt} blink={mole.blink} happy={mole.happy} waving={mole.waving} lamp={glow} />
            </g>
          )}
        </g>
        <Port t={t} alarm={alarm} />
        <Dust t={t} />

        {alarm > 0 && (
          <rect x={vx - 50} y={vy - 50} width={vw + 100} height={vh + 100} fill="#ff4d42" opacity={alarm * (0.06 + 0.12 * wave(t, 900))} />
        )}
        <rect x={vx - 50} y={vy - 50} width={vw + 100} height={vh + 100} fill="url(#kf-vignette)" pointerEvents="none" />
      </svg>

      <div className={`kf-copy${caption?.key === 'purpose' ? ' lower' : ''}`}>
        {caption?.key === 'night' && (
          <div className="kf-caption" key="night">
            <p className="kf-kicker">23:47, Kancelaria Nowak</p>
            <h1>Biuro jest puste.</h1>
          </div>
        )}
        {caption?.key === 'motion' && (
          <div className="kf-caption" key="motion">
            <h1>Coś porusza się w&nbsp;kablach.</h1>
          </div>
        )}
        {caption?.key === 'alarm' && (
          <div className="kf-caption alarm" key="alarm">
            <h1>Ktoś jest w&nbsp;Twojej sieci?</h1>
          </div>
        )}
        {caption?.key === 'calm' && (
          <div className="kf-caption" key="calm">
            <h1>
              Spokojnie.
              {t >= T.happy && <em className="kf-accent"> To&nbsp;Twój kret.</em>}
            </h1>
          </div>
        )}
        {caption?.key === 'purpose' && (
          <div className="kf-caption" key="purpose">
            <h1>Kret sprawdza, którędy wszedłby ten prawdziwy.</h1>
            {t >= 15600 && <p className="kf-sub">Pokazuje drogę i&nbsp;mówi, co zamknąć najpierw. Zanim zrobi to ktoś inny.</p>}
            {t >= 16500 && (
              <div className="kf-cta">
                <Link className="btn btn-lamp btn-lg" to="/app">Otwórz aplikację</Link>
                <button type="button" className="kf-link" onClick={play}>Obejrzyj jeszcze raz</button>
              </div>
            )}
          </div>
        )}
      </div>

      {!ended && (
        <button type="button" className="kf-skip" onClick={skip}>
          Pomiń
        </button>
      )}
    </section>
  )
}
