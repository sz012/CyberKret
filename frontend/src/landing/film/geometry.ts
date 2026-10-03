export interface Pt {
  x: number
  y: number
}

export type Cubic = [Pt, Pt, Pt, Pt]

export const P = (x: number, y: number): Pt => ({ x, y })

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))

export const mix = (a: number, b: number, k: number) => a + (b - a) * k

export const ease = {
  linear: (k: number) => k,
  in: (k: number) => k * k * k,
  out: (k: number) => 1 - Math.pow(1 - k, 3),
  inOut: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k: number) => {
    const c1 = 1.5
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)
  },
}

export function span(t: number, start: number, end: number, fn: (k: number) => number = ease.inOut): number {
  return fn(clamp((t - start) / (end - start)))
}

export function bump(t: number, start: number, end: number): number {
  const k = clamp((t - start) / (end - start))
  return k <= 0 || k >= 1 ? 0 : Math.sin(Math.PI * k)
}

export const wave = (t: number, period: number) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period)

function cubicAt([a, b, c, d]: Cubic, k: number): Pt {
  const u = 1 - k
  return {
    x: u * u * u * a.x + 3 * u * u * k * b.x + 3 * u * k * k * c.x + k * k * k * d.x,
    y: u * u * u * a.y + 3 * u * u * k * b.y + 3 * u * k * k * c.y + k * k * k * d.y,
  }
}

export interface Track {
  d: string
  length: number
  ends: number[]
  at: (u: number) => Pt & { angle: number }
}

export function track(segments: Cubic[], samples = 48): Track {
  const points: Pt[] = [segments[0][0]]
  const lengths: number[] = [0]
  const ends: number[] = []
  let total = 0
  for (const segment of segments) {
    for (let s = 1; s <= samples; s++) {
      const p = cubicAt(segment, s / samples)
      const q = points[points.length - 1]
      total += Math.hypot(p.x - q.x, p.y - q.y)
      points.push(p)
      lengths.push(total)
    }
    ends.push(total)
  }
  const d = segments
    .map(([a, b, c, e], i) => `${i === 0 ? `M${a.x} ${a.y} ` : ''}C${b.x} ${b.y} ${c.x} ${c.y} ${e.x} ${e.y}`)
    .join(' ')

  const at = (u: number) => {
    const target = clamp(u) * total
    let lo = 0
    let hi = lengths.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (lengths[mid] < target) lo = mid
      else hi = mid
    }
    const segmentLength = lengths[hi] - lengths[lo] || 1
    const k = (target - lengths[lo]) / segmentLength
    const a = points[lo]
    const b = points[hi]
    return {
      x: mix(a.x, b.x, k),
      y: mix(a.y, b.y, k),
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    }
  }

  return { d, length: total, ends: ends.map((e) => e / total), at }
}

export interface Leg {
  start: number
  end: number
}

export function schedule(start: number, durations: number[], pauses: number[]): Leg[] {
  const legs: Leg[] = []
  let cursor = start
  durations.forEach((duration, i) => {
    legs.push({ start: cursor, end: cursor + duration })
    cursor += duration + (pauses[i] ?? 0)
  })
  return legs
}

export function legProgress(t: number, legs: Leg[], ends: number[]): number {
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]
    const from = i === 0 ? 0 : ends[i - 1]
    if (t < leg.start) return from
    if (t <= leg.end) return mix(from, ends[i], ease.inOut((t - leg.start) / (leg.end - leg.start)))
  }
  return 1
}

export type Box = [number, number, number, number]

export function frame(box: Box, aspect: number): Box {
  const [x, y, w, h] = box
  const cx = x + w / 2
  const cy = y + h / 2
  const width = w / h > aspect ? w : h * aspect
  const height = width / aspect
  return [cx - width / 2, cy - height / 2, width, height]
}

export function mixBox(a: Box, b: Box, k: number): Box {
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k), mix(a[3], b[3], k)]
}

export const RIG_FEET = P(108, 188)
export const RIG_BODY = P(118, 128)
export const RIG_LAMP = P(158, 55)
export const RIG_NECK = P(128, 118)

export function rotateAround(p: Pt, c: Pt, degrees: number): Pt {
  const r = (degrees * Math.PI) / 180
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * Math.cos(r) - dy * Math.sin(r), y: c.y + dx * Math.sin(r) + dy * Math.cos(r) }
}

export const toward = (p: Pt, degrees: number, length: number): Pt => ({
  x: p.x + Math.cos((degrees * Math.PI) / 180) * length,
  y: p.y + Math.sin((degrees * Math.PI) / 180) * length,
})
