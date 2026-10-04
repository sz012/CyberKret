export const SCENES = [
  { id: 'intro', label: 'Noc w biurze', seconds: 18 },
  { id: 'company', label: 'Twoja firma', seconds: 11 },
  { id: 'tunnels', label: 'Droga ataku', seconds: 17 },
  { id: 'fix', label: 'Pierwszy ruch', seconds: 9 },
  { id: 'mail', label: 'Podejrzany mail', seconds: 17 },
  { id: 'incident', label: 'Plan działania', seconds: 13 },
  { id: 'end', label: 'Twój kret', seconds: 11 },
] as const

export function makeTimeline(audioDurations: Partial<Record<number, number>> = {}) {
  let start = 0
  return SCENES.map((scene, index) => {
    const duration = Math.max(scene.seconds, (audioDurations[index] || 0) + 1)
    const shot = { ...scene, start, duration, end: start + duration }
    start += duration
    return shot
  })
}

export function sceneAt(time: number, timeline: ReturnType<typeof makeTimeline>) {
  return Math.max(0, timeline.findLastIndex((scene) => time >= scene.start))
}

export function timeLabel(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
