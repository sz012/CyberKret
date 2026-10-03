import { memo } from 'react'
import { bump, ease, span, wave } from './geometry'
import { AMBIENT, FLOOR, HINGE_X, INTRUDER, PORT_X, TAGS, T } from './timeline'

const SURFACE = FLOOR - 6
const INK = { line: '#232933', line2: '#313845', fill: '#0b0e12', fill2: '#10141a', fill3: '#151a21' }
const BINDER_TONES = ['#171c24', '#1b212a', '#151a21', '#1d232d']

const Window = () => (
  <g transform="translate(905 74)">
    <rect width="250" height="230" fill="url(#kf-sky)" />
    <path d="M0 230V178H20V152H46V188H68V140H90V162H110V122H132V170H150V146H176V184H196V156H222V174H250V230Z" fill="#0c121a" />
    <path d="M121 122V100" stroke="#0c121a" strokeWidth="2.5" />
    <circle className="kf-beacon" cx="121" cy="99" r="2" fill="#ff6159" />
    <g fill="#ffd479">
      <rect className="kf-city kf-city-1" x="26" y="162" width="3" height="4" />
      <rect className="kf-city kf-city-2" x="74" y="150" width="3" height="4" />
      <rect className="kf-city kf-city-3" x="138" y="180" width="3" height="4" />
      <rect className="kf-city kf-city-2" x="202" y="166" width="3" height="4" />
      <rect className="kf-city kf-city-1" x="96" y="176" width="3" height="4" />
      <rect className="kf-city kf-city-3" x="160" y="156" width="3" height="4" />
    </g>
    {Array.from({ length: 9 }, (_, i) => (
      <rect key={i} x="0" y={3 + i * 7} width="250" height="4.2" fill="#121821" />
    ))}
    <path d="M238 0V70" stroke="#1d232c" strokeWidth="1.2" />
    <rect width="250" height="230" fill="none" stroke={INK.line2} strokeWidth="3" />
    <path d="M125 0V230M0 118H250" stroke={INK.line2} strokeWidth="2" />
    <rect x="-10" y="230" width="270" height="6" rx="1" fill={INK.fill3} stroke={INK.line} />
  </g>
)

const Shelves = () => (
  <g transform="translate(70 268)">
    <rect width="270" height={SURFACE - 268} fill={INK.fill} stroke={INK.line} strokeWidth="1.5" />
    <rect width="270" height="8" fill={INK.fill3} />
    <rect y="96" width="270" height="7" fill={INK.fill3} />
    <rect y={SURFACE - 268 - 8} width="270" height="8" fill={INK.fill3} />
    {[
      { y: 14, h: 80 },
      { y: 111, h: 70 },
    ].map((row, r) =>
      Array.from({ length: 9 }, (_, i) => (
        <g key={`${r}-${i}`} transform={`translate(${12 + i * 28} ${row.y})`}>
          <rect width="24" height={row.h} rx="2" fill={BINDER_TONES[(i * 3 + r) % 4]} stroke={INK.line2} />
          <rect x="5" y="9" width="14" height="22" rx="1.5" fill="#c9ced8" opacity="0.09" />
          <rect x="8" y="15" width="8" height="1.6" fill="#c9ced8" opacity="0.26" />
          <rect x="8" y="19" width="5" height="1.6" fill="#c9ced8" opacity="0.18" />
          <circle cx="12" cy={row.h - 14} r="3.4" fill="#06080a" stroke={INK.line2} />
        </g>
      )),
    )}
  </g>
)

const RouterCabinet = () => (
  <g>
    <path d="M468 400C484 404 494 428 494 466" fill="none" stroke="#1d232d" strokeWidth="3" />
    <rect x="384" y="404" width="100" height={SURFACE - 404} fill={INK.fill} stroke={INK.line} strokeWidth="1.5" />
    <path d="M434 408V460" stroke={INK.line} />
    <rect x="425" y="426" width="2" height="12" rx="1" fill={INK.line2} />
    <rect x="441" y="426" width="2" height="12" rx="1" fill={INK.line2} />
    <path d="M406 390L398 350M462 390L470 350" stroke={INK.line2} strokeWidth="3" strokeLinecap="round" />
    <rect x="398" y="389" width="72" height="15" rx="3" fill={INK.fill3} stroke={INK.line2} strokeWidth="1.2" />
  </g>
)

const Desk = () => (
  <g>
    <rect x="530" y="361" width="84" height={SURFACE - 361} fill={INK.fill} stroke={INK.line} strokeWidth="1.5" />
    <path d="M530 395H614M530 429H614" stroke={INK.line} />
    {[376, 410, 444].map((y) => (
      <rect key={y} x="562" y={y} width="20" height="2" rx="1" fill={INK.line2} />
    ))}
    <rect x="744" y="361" width="7" height={SURFACE - 361} fill={INK.fill3} />
    <rect x="520" y="352" width="240" height="9" rx="2" fill={INK.fill3} stroke={INK.line2} />
    <rect x="622" y="336" width="16" height="11" fill={INK.fill3} />
    <rect x="602" y="346" width="56" height="6" rx="2" fill={INK.fill3} stroke={INK.line} />
    <rect x="548" y="240" width="164" height="96" rx="5" fill="#090c10" stroke={INK.line2} strokeWidth="2" />
    <rect x="666" y="345" width="70" height="7" rx="2" fill={INK.fill3} stroke={INK.line2} />
    <rect x="528" y="347" width="50" height="5" rx="1" fill="#181d25" stroke={INK.line} />
    <rect x="532" y="343" width="44" height="4" rx="1" fill="#1e242d" />
  </g>
)

const Floor = () => (
  <g>
    <rect x="-1600" y="452" width="4400" height="12" fill="#0a0d10" />
    <path d="M-1600 452H2800" stroke={INK.line} />
    <rect x="-1600" y={SURFACE} width="4400" height="14" fill="#11151b" />
    <rect x="-1600" y={SURFACE} width="4400" height="14" fill="url(#kf-hatch)" />
    {Array.from({ length: 45 }, (_, i) => (
      <path key={i} d={`M${-1600 + i * 100} ${SURFACE}v14`} stroke="#07090b" strokeWidth="2" />
    ))}
    <path d={`M-1600 ${SURFACE}H2800`} stroke="#2b323d" strokeWidth="1.5" />
    <path d={`M-1600 ${SURFACE + 14}H2800`} stroke="#171c23" />
  </g>
)

const Underground = () => (
  <g>
    <rect x="-1600" y={SURFACE + 14} width="4400" height="2400" fill="#060709" />
    <rect x="-1600" y={SURFACE + 14} width="4400" height="2400" fill="url(#kf-dots)" />
    {Array.from({ length: 44 }, (_, i) => {
      const x = -1550 + i * 100
      return (
        <g key={i} fill="#0e1217">
          <rect x={x - 2} y={SURFACE + 14} width="4" height="38" />
          <rect x={x - 9} y={SURFACE + 50} width="18" height="3" rx="1" />
        </g>
      )
    })}
  </g>
)

export const Room = memo(function Room() {
  return (
    <g>
      <rect x="-1600" y="-1600" width="4400" height={1600 + SURFACE} fill="url(#kf-wall)" />
      <Window />
      <Shelves />
      <RouterCabinet />
      <Desk />
      <Floor />
      <Underground />
    </g>
  )
})

export function UnderCables({ t }: { t: number }) {
  return (
    <g fill="none" strokeLinecap="round" opacity={1 - 0.75 * span(t, T.net[0], T.net[1])}>
      {AMBIENT.map((cable, i) => (
        <path key={i} d={cable.d} stroke="#131820" strokeWidth="6" />
      ))}
      <path d={INTRUDER.d} stroke="#141c28" strokeWidth="7" />
      <path d={INTRUDER.d} stroke="#22314a" strokeWidth="1.6" />
    </g>
  )
}

export function Clock({ t }: { t: number }) {
  const whole = Math.floor(t / 1000)
  const tick = span(t - whole * 1000, 0, 140, ease.out)
  const second = (T.clockSeconds + whole - 1 + tick) * 6
  return (
    <g transform="translate(850 166)">
      <circle r="30" fill="#0b0e12" stroke={INK.line2} strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} y1="-25" y2={i % 3 ? -22.5 : -20} stroke={i % 3 ? '#3a4150' : '#56606f'} strokeWidth={i % 3 ? 1.4 : 2} transform={`rotate(${i * 30})`} />
      ))}
      <line y1="2" y2="-13" stroke="#8e97a8" strokeWidth="3" strokeLinecap="round" transform="rotate(353.5)" />
      <line y1="3" y2="-20" stroke="#c9ced8" strokeWidth="2" strokeLinecap="round" transform="rotate(282)" />
      <line y1="5" y2="-23" stroke="#ff6159" strokeWidth="1" strokeLinecap="round" transform={`rotate(${second})`} />
      <circle r="2.2" fill="#c9ced8" />
    </g>
  )
}

export function RouterLeds({ t, alarm }: { t: number; alarm: number }) {
  return (
    <g>
      {Array.from({ length: 5 }, (_, i) => {
        const calm = 0.35 + 0.65 * wave(t + i * 230, 900 + i * 170)
        const red = alarm > 0.05
        return (
          <circle key={i} cx={410 + i * 10} cy="396.5" r="1.6" fill={red ? '#ff6159' : i === 4 ? '#6ea8ff' : '#5fd08a'} opacity={red ? 0.4 + 0.6 * wave(t + i * 90, 260) : calm} />
        )
      })}
    </g>
  )
}

export function Monitor({ t }: { t: number }) {
  const alert = span(t, T.monitorAlert, T.monitorAlert + 300) * (1 - span(t, T.ident - 160, T.ident + 40))
  const ok = span(t, T.ident - 60, T.ident + 260)
  const idle = 1 - Math.max(alert, ok)
  const stamp = `23:47:${String(T.clockSeconds + Math.floor(T.monitorAlert / 1000)).padStart(2, '0')}`
  return (
    <g>
      <rect x="556" y="248" width="148" height="80" rx="2" fill="#080a0d" />
      <g opacity={idle}>
        <text x="630" y="292" textAnchor="middle" className="kf-lock">23:47</text>
        <text x="630" y="308" textAnchor="middle" className="kf-lock-sub">ekran zablokowany</text>
      </g>
      <g opacity={alert}>
        <rect x="556" y="248" width="148" height="80" rx="2" fill="#2a0e0f" opacity={0.8 + 0.2 * wave(t, 700)} />
        <path d="M630 258l9 16h-18z" fill="none" stroke="#ff6159" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M630 264.5v4.5M630 271.6v.4" stroke="#ff6159" strokeWidth="1.8" strokeLinecap="round" />
        <text x="630" y="296" textAnchor="middle" className="kf-screen">Nieznany ruch w sieci</text>
        <text x="630" y="311" textAnchor="middle" className="kf-screen-sub">port 3 · {stamp}</text>
      </g>
      <g opacity={ok}>
        <rect x="556" y="248" width="148" height="80" rx="2" fill="#0d1712" />
        <circle cx="630" cy="268" r="9" fill="none" stroke="#5fd08a" strokeWidth="1.6" />
        <path d="M625.5 268.2l3.2 3.2 6-6.6" fill="none" stroke="#5fd08a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="630" y="296" textAnchor="middle" className="kf-screen ok">Rozpoznano: cyberKret</text>
        <text x="630" y="311" textAnchor="middle" className="kf-screen-sub ok">test autoryzowany</text>
      </g>
      <circle cx="704" cy="332" r="1.3" fill={alert > 0.5 ? '#ff6159' : '#5fd08a'} opacity="0.8" />
      <rect x="520" y="352" width="240" height="3" fill={alert > ok ? '#ff6159' : '#5fd08a'} opacity={0.12 * Math.max(alert, ok)} />
    </g>
  )
}

export function Port({ t, alarm, warm }: { t: number; alarm: number; warm: number }) {
  const open = span(t, T.lid, T.lid + 320, ease.back)
  const close = span(t, T.lidClose[0], T.lidClose[1], ease.out)
  const rattle = t < T.lid ? alarm * 1.4 * Math.sin(t / 19) : 0
  const angle = -168 * open * (1 - close) + rattle
  const lift = t < T.lid ? -alarm * 1.1 * Math.abs(Math.sin(t / 23)) : 0
  const seam = t < T.lid ? alarm * (0.35 + 0.65 * wave(t, 620)) : 0
  const inner = span(t, T.lid, T.lid + 200) * (1 - span(t, T.lidClose[0], T.lidClose[1]))
  return (
    <g>
      <rect x={HINGE_X + 2} y={SURFACE} width="92" height="14" fill="#030405" />
      <rect x={HINGE_X + 2} y={SURFACE} width="92" height="14" fill="url(#kf-port-cold)" opacity={inner * (1 - warm)} />
      <rect x={HINGE_X + 2} y={SURFACE} width="92" height="14" fill="url(#kf-port-warm)" opacity={inner * warm} />
      {seam > 0 && (
        <g fill="#ff6159">
          <rect x={HINGE_X - 6} y={SURFACE - 6} width="108" height="10" rx="5" opacity={0.18 * seam} />
          <rect x={HINGE_X} y={SURFACE - 2} width="96" height="2" opacity={0.9 * seam} />
        </g>
      )}
      <g transform={`translate(${HINGE_X} ${SURFACE - 2 + lift}) rotate(${angle})`}>
        <rect width="96" height="8" rx="2" fill="#1a1f27" stroke="#3a4150" />
        <rect x="38" y="2.5" width="20" height="3" rx="1.5" fill="#4a5262" />
      </g>
    </g>
  )
}

export function PortLight({ t, warm }: { t: number; warm: number }) {
  const burst = span(t, T.lid, T.lid + 140, ease.out) * (1 - span(t, T.lid + 220, T.rise[1] + 300))
  const residual = 0.16 * span(t, T.lid, T.lid + 300) * (1 - span(t, T.dive[1], T.lidClose[1]))
  const opacity = Math.max(burst * 0.85, residual)
  if (opacity <= 0.001) return null
  return (
    <g className="kf-glow" opacity={opacity}>
      <polygon points={`${HINGE_X + 4},${SURFACE} ${HINGE_X + 92},${SURFACE} 980,-60 620,-60`} fill="url(#kf-shaft-cold)" opacity={1 - warm} />
      <polygon points={`${HINGE_X + 4},${SURFACE} ${HINGE_X + 92},${SURFACE} 980,-60 620,-60`} fill="url(#kf-shaft-warm)" opacity={warm} />
    </g>
  )
}

export function Motes({ t }: { t: number }) {
  const k = (t - T.lid) / 1800
  if (k <= 0 || k >= 1) return null
  return (
    <g fill="#e9eefc">
      {Array.from({ length: 16 }, (_, i) => {
        const x = PORT_X - 40 + ((i * 47) % 80) + 14 * Math.sin(i * 2.1 + k * 3)
        const y = SURFACE - 10 - (40 + ((i * 29) % 90)) * k * (1.4 + (i % 4) * 0.3)
        return <circle key={i} cx={x} cy={y} r={0.8 + (i % 3) * 0.45} opacity={(1 - k) * (0.35 + (i % 5) * 0.1)} />
      })}
    </g>
  )
}

const OUTLINES: Record<string, { x: number; y: number; w: number; h: number; r: number }> = {
  monitor: { x: 548, y: 240, w: 164, h: 96, r: 5 },
  akta: { x: 70, y: 268, w: 270, h: SURFACE - 268, r: 1 },
  router: { x: 398, y: 389, w: 72, h: 15, r: 3 },
}

export function Tags({ t }: { t: number }) {
  if (t < T.scan[0] || t > T.tagsOut[1]) return null
  const out = 1 - span(t, T.tagsOut[0], T.tagsOut[1])
  return (
    <g>
      {TAGS.map((tag) => {
        const shown = span(t, tag.t, tag.t + 260, ease.out) * out
        if (shown <= 0) return null
        const flash = bump(t, tag.t - 40, tag.t + 520)
        const box = OUTLINES[tag.id]
        const lead = tag.at.y - tag.to.y
        return (
          <g key={tag.id}>
            <rect x={box.x - 3} y={box.y - 3} width={box.w + 6} height={box.h + 6} rx={box.r + 2} fill="none" stroke="#ffd479" strokeWidth="1.4" opacity={(0.25 + 0.65 * flash) * out} />
            <circle cx={tag.at.x} cy={tag.at.y} r="3" fill="#ffd479" opacity={shown} />
            <path d={`M${tag.at.x} ${tag.at.y}V${tag.to.y}`} stroke="#ffd479" strokeWidth="1" strokeDasharray={lead} strokeDashoffset={lead * (1 - shown)} opacity="0.75" />
            <text x={tag.to.x} y={tag.to.y - 8 + 6 * (1 - shown)} textAnchor="middle" className="kf-tag" opacity={shown}>
              {tag.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
