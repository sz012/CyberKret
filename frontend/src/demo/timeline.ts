export const SCENES = [
  { id: 'intro', label: 'Night at the office', seconds: 18 },
  { id: 'company', label: 'Your company', seconds: 11 },
  { id: 'tunnels', label: 'Attack path', seconds: 17 },
  { id: 'fix', label: 'First move', seconds: 9 },
  { id: 'mail', label: 'Suspicious email', seconds: 17 },
  { id: 'incident', label: 'Action plan', seconds: 13 },
  { id: 'end', label: 'Your mole', seconds: 11 },
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
