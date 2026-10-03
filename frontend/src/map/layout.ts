import type { KretPath, KretResult, KretSegment } from '../api/types'

export interface Point {
  x: number
  y: number
}

export interface PositionLayout extends Point {
  r: number
  label: 'right' | 'below' | 'below-right'
}

export const VIEW = { width: 1000, height: 620 }
export const SURFACE_Y = 102
export const MOLE_HOME: Point = { x: 520, y: 92 }

export const POSITION_LAYOUT: Record<string, PositionLayout> = {
  email_control: { x: 420, y: 250, r: 22, label: 'right' },
  email_spoof: { x: 760, y: 250, r: 22, label: 'right' },
  software_admin: { x: 420, y: 380, r: 22, label: 'below-right' },
  deadlines_missed: { x: 420, y: 520, r: 30, label: 'below' },
  client_data_read: { x: 230, y: 520, r: 30, label: 'below' },
  ksef_access: { x: 90, y: 520, r: 30, label: 'below' },
  clients_pay_attacker: { x: 800, y: 520, r: 30, label: 'below' },
}

export const POSITION_LABELS: Record<string, string> = {
  email_control: 'Przejęta skrzynka',
  email_spoof: 'Podrobiony nadawca',
  software_admin: 'Konto administratora',
  deadlines_missed: 'Terminy klientów',
  client_data_read: 'Dane klientów',
  ksef_access: 'Faktury w KSeF',
  clients_pay_attacker: 'Pieniądze klientów',
}

export const TARGET_IDS = ['client_data_read', 'ksef_access', 'clients_pay_attacker', 'deadlines_missed']

export const ENTRY_HOLES: Record<string, { x: number; label: string; anchor: 'start' | 'end' }> = {
  email_control: { x: 420, label: 'wejście: logowanie', anchor: 'end' },
  email_spoof: { x: 760, label: 'wejście: podszycie', anchor: 'start' },
  client_data_read: { x: 200, label: 'wejście: link', anchor: 'end' },
}

export const STRATA = [
  { y: 102, height: 128, fill: '#3a2c22', label: '0,5 m · wejścia' },
  { y: 230, height: 130, fill: '#32261e', label: '1,5 m · poczta i konta' },
  { y: 360, height: 130, fill: '#2b211a', label: '3 m · uprawnienia' },
  { y: 490, height: 130, fill: '#241b16', label: '5 m · to, co cenne' },
]

export const segmentKey = (source: string, target: string) => `${source}>${target}`

function startPoint(source: string, target: string): Point | null {
  if (source === 'internet') {
    const hole = ENTRY_HOLES[target]
    return hole ? { x: hole.x, y: SURFACE_Y } : null
  }
  return POSITION_LAYOUT[source] ?? null
}

function curveTail(a: Point, b: Point): string {
  if (Math.abs(a.x - b.x) < 1) return `L${b.x} ${b.y}`
  if (Math.abs(a.y - b.y) < 1) {
    const dip = a.y + 22
    return `C${a.x} ${dip}, ${b.x} ${dip}, ${b.x} ${b.y}`
  }
  const middle = (a.y + b.y) / 2
  return `C${a.x} ${middle}, ${b.x} ${middle}, ${b.x} ${b.y}`
}

export function segmentPath(source: string, target: string): string | null {
  const a = startPoint(source, target)
  const b = POSITION_LAYOUT[target]
  if (!a || !b) return null
  return `M${a.x} ${a.y} ${curveTail(a, b)}`
}

export function routePath(path: KretPath): { d: string; start: Point } | null {
  const first = path.steps[0]
  const start = first ? startPoint(first.source, first.target) : null
  if (!start) return null
  let d = `M${start.x} ${start.y}`
  let current = start
  for (const step of path.steps) {
    const next = POSITION_LAYOUT[step.target]
    if (!next) return null
    d += ` ${curveTail(current, next)}`
    current = next
  }
  return { d, start }
}

export type Tone = 'bad' | 'warn' | 'ok' | 'idle'

export function targetTone(result: KretResult | null | undefined, id: string): Tone {
  const target = result?.targets.find((t) => t.id === id)
  if (!target) return 'idle'
  if (target.open) return 'bad'
  if (target.possible) return 'warn'
  return 'ok'
}

export function footholdTone(result: KretResult | null | undefined, id: string): Tone {
  if (!result) return 'idle'
  const through = result.paths.filter((p) => p.steps.some((s) => s.target === id))
  if (through.some((p) => p.status === 'open')) return 'bad'
  if (through.length) return 'warn'
  return 'idle'
}

export function pathSegments(path: KretPath): string[] {
  return path.steps.map((s) => segmentKey(s.source, s.target))
}

export function segmentsOf(result: KretResult | null | undefined): KretSegment[] {
  return result?.segments ?? []
}
