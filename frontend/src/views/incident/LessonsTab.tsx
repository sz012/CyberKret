import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../../api/client'
import type { Incident, KretResult, LessonsResult, Organization } from '../../api/types'
import { Icon } from '../../components/Icon'
import { Mascot } from '../../components/Mascot'
import { ErrorNote, Panel, Pill } from '../../components/ui'
import { countLabel } from '../../lib/format'
import { GroundMap } from '../../map/GroundMap'

interface Props {
  incident: Incident
  org: Organization
  pending: boolean
  onClose: () => void
  onApplied: () => Promise<void>
}

export function LessonsTab({ incident, org, pending, onClose, onApplied }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(incident.lessons.filter((lesson) => lesson.state !== 'present').map((lesson) => lesson.safeguard)),
  )
  const [result, setResult] = useState<LessonsResult | null>(null)
  const [shown, setShown] = useState<KretResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closed = incident.status === 'closed'

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const toggle = (safeguard: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(safeguard)) next.delete(safeguard)
      else next.add(safeguard)
      return next
    })
  }

  const apply = async () => {
    setBusy(true)
    setError(null)
    try {
      const applied = await api.applyLessons(incident.id, [...selected])
      setResult(applied)
      setShown(applied.before)
      timer.current = setTimeout(() => setShown(applied.after), 900)
      await onApplied()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const pendingLessons = incident.lessons.filter((lesson) => lesson.state !== 'present')

  return (
    <>
      <Panel title="Zasypywanie tuneli" aside={closed ? 'incydent zamknięty' : 'dostępne po zamknięciu incydentu'}>
        <div className="panel-body">
          <p className="lead lead--small">
            Incydent pokazał, którędy da się wejść. Zasypcie te drogi, a kret przekopie mapę jeszcze raz i sprawdzi,
            czy naprawdę są zamknięte.
          </p>
          <ul className="lessons">
            {incident.lessons.map((lesson) => {
              const done = lesson.state === 'present'
              return (
                <li key={lesson.safeguard} className={`lesson${done ? ' is-done' : ''}`}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={done || selected.has(lesson.safeguard)}
                      disabled={done || !closed || busy || Boolean(result)}
                      onChange={() => toggle(lesson.safeguard)}
                    />
                    <span>
                      <strong>{lesson.fix}</strong>
                      <span className="lesson__reason">{lesson.reason}</span>
                    </span>
                  </label>
                  {done && <Pill tone="ok">zrobione</Pill>}
                </li>
              )
            })}
          </ul>
          {error && <ErrorNote message={error} />}
          <div className="form__actions">
            {!closed ? (
              <button type="button" className="btn btn--lamp" onClick={onClose} disabled={pending}>
                <Icon name="check" size={16} />
                Zamknij incydent
              </button>
            ) : pendingLessons.length && !result ? (
              <button type="button" className="btn btn--lamp" onClick={apply} disabled={busy || selected.size === 0}>
                <Icon name="play" size={16} />
                {busy ? 'Kret kopie…' : 'Zasyp i wpuść kreta'}
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      {result && (
        <Panel title="Kret sprawdził ponownie" aside={`zastosowano ${result.applied.length}`}>
          <div className="panel-body">
            <div className="compare">
              <div className="compare__item">
                <span className="compare__number compare__number--bad">{result.before.total}</span>
                <span>{countLabel(result.before.total, 'droga', 'drogi', 'dróg')} przed</span>
              </div>
              <Icon name="arrow" size={28} className="compare__arrow" />
              <div className="compare__item">
                <span className={`compare__number compare__number--${result.after.total ? 'warn' : 'ok'}`}>
                  {result.after.total}
                </span>
                <span>{countLabel(result.after.total, 'droga', 'drogi', 'dróg')} po</span>
              </div>
              <Mascot mood={result.after.total ? 'calm' : 'happy'} beam={false} className="compare__mole" />
            </div>
            <p className="muted">{result.after.outro}</p>
          </div>
          <div className="ground-panel ground-panel--flat">
            <GroundMap result={shown} orgName={org.name} />
          </div>
        </Panel>
      )}
    </>
  )
}
