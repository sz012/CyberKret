import type { LogEntry } from '../api/types'
import { formatTime } from '../lib/format'

const KIND_TONE: Record<string, string> = {
  incident_opened: 'bad',
  incident_closed: 'ok',
  continuity: 'ok',
  lessons: 'ok',
  confirmation: 'ok',
  plan: 'hi',
  plan_diff: 'hi',
  fact: 'warn',
  kret_run: 'lamp',
  domain_check: 'lamp',
  message_check: 'lamp',
}

export function Timeline({ entries, empty = 'Dziennik jest pusty.' }: { entries: LogEntry[]; empty?: string }) {
  if (!entries.length) return <p className="muted">{empty}</p>
  return (
    <ol className="timeline">
      {entries.map((entry) => (
        <li key={entry.id} className={`timeline__item timeline__item--${KIND_TONE[entry.kind] ?? 'muted'}`}>
          <time dateTime={entry.created_at}>{formatTime(entry.created_at)}</time>
          <span>{entry.message}</span>
        </li>
      ))}
    </ol>
  )
}
