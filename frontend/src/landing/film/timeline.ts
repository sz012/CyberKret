import { P, bump, clamp, ease, frame, invert, legProgress, mix, mixBox, schedule, span, track, type Box, type Cubic, type Pt } from './geometry'

export const END = 16800
export const FLOOR = 470
export const PORT_X = 820
export const HINGE_X = 772
export const HOVER = P(PORT_X, 326)
export const COLD = '#dbe5ff'
export const WARM = '#ffd479'

export const INTRUDER = track([
  [P(-700, 560), P(-500, 560), P(-260, 560), P(-60, 560)],
  [P(-60, 560), P(120, 560), P(220, 604), P(380, 604)],
  [P(380, 604), P(520, 604), P(560, 548), P(700, 552)],
  [P(700, 552), P(790, 554), P(822, 566), P(PORT_X, FLOOR + 10)],
])

export const AMBIENT = [
  track([[P(-700, 528), P(0, 522), P(700, 540), P(1900, 516)]]),
  track([[P(-700, 652), P(200, 664), P(900, 628), P(1900, 662)]]),
]

export const SWITCH = P(600, 640)
export const INTERNET = P(60, 520)
export const TARGET = P(590, 930)

export type Status = 'bad' | 'ok' | 'warn'

export interface NetNode {
  id: string
  label: string
  icon: string
  p: Pt
  status: Status
  verdict: string
  side?: 'left' | 'right'
}

export const NODES: NetNode[] = [
  { id: 'siec', label: 'Sieć i router', icon: 'router', p: P(170, 740), status: 'bad', verdict: 'pulpit zdalny otwarty', side: 'left' },
  { id: 'komputery', label: 'Komputery', icon: 'laptop', p: P(370, 800), status: 'ok', verdict: 'w porządku' },
  { id: 'konta', label: 'Konta i hasła', icon: 'key', p: P(600, 830), status: 'bad', verdict: 'admin bez MFA', side: 'right' },
  { id: 'poczta', label: 'Poczta', icon: 'mail', p: P(830, 800), status: 'warn', verdict: 'brak DMARC' },
  { id: 'kopie', label: 'Kopie zapasowe', icon: 'disk', p: P(1040, 740), status: 'ok', verdict: 'w porządku' },
]

const UPLINK: Cubic = [P(INTERNET.x, INTERNET.y + 24), P(60, 630), P(110, 710), NODES[0].p]
const FEED: Cubic = [SWITCH, P(470, 680), P(220, 680), NODES[0].p]
const DROP: Cubic = [P(PORT_X, FLOOR + 10), P(PORT_X, 560), P(700, 620), SWITCH]
const BUS: Cubic[] = [
  [NODES[0].p, P(240, 790), P(300, 800), NODES[1].p],
  [NODES[1].p, P(450, 800), P(520, 830), NODES[2].p],
  [NODES[2].p, P(680, 830), P(750, 800), NODES[3].p],
  [NODES[3].p, P(910, 800), P(980, 770), NODES[4].p],
]

export const ROUTE = track([DROP, FEED, ...BUS])
export const CABLES = [track([UPLINK]), track([DROP]), track([FEED]), track(BUS)]

export const TUNNEL = track([
  UPLINK,
  [NODES[0].p, P(250, 950), P(470, 950), NODES[2].p],
  [NODES[2].p, P(612, 852), P(612, 878), P(TARGET.x, TARGET.y - 26)],
])

export const LEGS = schedule(11800, [600, 560, 420, 420, 420, 420], [100, 220, 220, 220, 220, 0])
export const ARRIVALS = NODES.map((_, i) => LEGS[i + 1].end)

export const T = {
  clockSeconds: 12,
  blip: [1700, 3100, 3350, 5000],
  monitorAlert: 2600,
  alarm: [5000, 7000, 7500],
  lid: 6800,
  rise: [6950, 7900],
  ident: 8250,
  scan: [8450, 9300],
  tagsOut: [9550, 9800],
  spin: [9900, 10300],
  dive: [10300, 10450, 10800],
  lidClose: [10900, 11150],
  net: [11000, 11600],
  tunnel: [15700, 16500],
  sub: 15600,
  cta: 16500,
}

export function beamAngle(t: number): number {
  return mix(-16, -198, span(t, T.scan[0], T.scan[1], ease.inOut))
}

function angleFromHover(p: Pt): number {
  const a = (Math.atan2(p.y - HOVER.y, p.x - HOVER.x) * 180) / Math.PI
  return a > 0 ? a - 360 : a
}

const TAG_SPOTS: { id: string; label: string; at: Pt; to: Pt }[] = [
  { id: 'monitor', label: 'komputer', at: P(630, 236), to: P(630, 196) },
  { id: 'akta', label: 'akta klientów', at: P(205, 268), to: P(205, 226) },
  { id: 'router', label: 'router', at: P(434, 388), to: P(434, 316) },
]

export const TAGS = TAG_SPOTS.map((tag) => ({
  ...tag,
  t: invert(beamAngle, angleFromHover(tag.at), T.scan[0], T.scan[1]),
}))

export function alarmLevel(t: number): number {
  const [start, hold, end] = T.alarm
  return span(t, start, start + 400) * (1 - span(t, hold, end))
}

export function blipProgress(t: number): number {
  const [start, junction, leave, port] = T.blip
  const from = INTRUDER.ends[0]
  const mid = INTRUDER.ends[1]
  if (t < junction) return mix(from, mid, span(t, start, junction, ease.out))
  if (t < leave) return mid + 0.004 * Math.sin((t - junction) / 40)
  return mix(mid, 1, span(t, leave, port, ease.inOut))
}

export interface ProbeState {
  visible: boolean
  p: Pt
  warm: number
  bright: number
  spin: number
  ring: number
  speed: number
}

export function probeState(t: number): ProbeState {
  const visible = t >= T.lid + 80 && t < T.dive[2]
  const rise = span(t, T.rise[0], T.rise[1], ease.out)
  const float = 3.5 * Math.sin((t - T.rise[1]) / 560) * span(t, T.rise[1] - 300, T.rise[1] + 500)
  const hoverY = mix(FLOOR + 30, HOVER.y, rise) + float
  let y = hoverY
  let speed = 0
  if (t >= T.dive[0]) {
    const lift = span(t, T.dive[0], T.dive[1], ease.out)
    const fall = span(t, T.dive[1], T.dive[2], ease.in)
    y = hoverY - 16 * lift * (1 - fall) + (FLOOR + 60 - hoverY) * fall
    speed = fall
  } else if (t < T.rise[1]) {
    speed = 1 - rise
  }
  const blink = Math.max(bump(t, T.ident - 420, T.ident - 270), bump(t, T.ident - 200, T.ident - 50))
  const spinUp = span(t, T.spin[0], T.spin[1], ease.in)
  return {
    visible,
    p: P(PORT_X, y),
    warm: span(t, T.ident - 60, T.ident + 380),
    bright: 1 - 0.8 * blink + 0.25 * spinUp,
    spin: t * 0.04 + 1100 * spinUp * spinUp,
    ring: mix(24, 17, spinUp),
    speed,
  }
}

const SHOTS: { t: number; wide: Box; narrow: Box }[] = [
  { t: 0, wide: [-40, 30, 1260, 690], narrow: [430, 70, 780, 640] },
  { t: 4300, wide: [-40, 30, 1260, 690], narrow: [430, 70, 780, 640] },
  { t: 5300, wide: [250, 40, 980, 590], narrow: [520, 130, 680, 560] },
  { t: 6800, wide: [300, 50, 930, 560], narrow: [540, 140, 660, 540] },
  { t: 7500, wide: [440, 40, 780, 480], narrow: [560, 140, 560, 460] },
  { t: 8400, wide: [440, 40, 780, 480], narrow: [560, 140, 560, 460] },
  { t: 8900, wide: [30, 20, 1180, 600], narrow: [300, 100, 760, 600] },
  { t: 9450, wide: [30, 20, 1180, 600], narrow: [60, 110, 740, 580] },
  { t: 9900, wide: [480, 50, 720, 460], narrow: [580, 150, 520, 450] },
  { t: 10400, wide: [480, 50, 720, 460], narrow: [580, 150, 520, 450] },
  { t: 11900, wide: [-40, 428, 1280, 900], narrow: [-40, 440, 1280, 760] },
]

const PHONE_END: Box = [-90, 791, 880, 620]

function followScout(t: number): Box {
  const p = ROUTE.at(legProgress(t, LEGS, ROUTE.ends))
  return [clamp(p.x - 260, -80, 820), p.y - 58, 520, 340]
}

function phoneNetwork(t: number): Box {
  const dive = SHOTS[SHOTS.length - 2].narrow
  if (t < 11900) return mixBox(dive, followScout(t), span(t, 10400, 11900))
  if (t < 15300) return followScout(t)
  return mixBox(followScout(t), PHONE_END, span(t, 15300, 16000))
}

export function camera(t: number, aspect: number): Box {
  const narrow = aspect < 0.95
  if (narrow && t >= 10400) return frame(phoneNetwork(t), aspect)
  const pick = (s: (typeof SHOTS)[number]) => (narrow ? s.narrow : s.wide)
  let box = pick(SHOTS[0])
  for (let i = 1; i < SHOTS.length; i++) {
    const a = SHOTS[i - 1]
    const b = SHOTS[i]
    if (t >= b.t) {
      box = pick(b)
      continue
    }
    box = mixBox(pick(a), pick(b), span(t, a.t, b.t))
    break
  }
  return frame(box, aspect)
}
