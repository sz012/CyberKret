import type { Phase } from '../api/types'
import { Icon } from './icons'

export default function PhaseStrip({ phases, closed }: { phases: Phase[]; closed: boolean }) {
  const current = closed ? -1 : phases.findIndex((p) => p.total > 0 && p.done < p.total)
  return (
    <ol className="phases" aria-label="Incident stages">
      {phases.map((p, i) => {
        const complete = p.total > 0 && p.done >= p.total
        return (
          <li key={p.id} className={`phase${complete ? ' done' : i === current ? ' current' : ''}`}>
            <span className="phase-n">{complete ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="phase-label">{p.label}</span>
            <span className="phase-count mono">{p.done}/{p.total}</span>
            <span className="phase-bar" aria-hidden="true">
              <span style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
