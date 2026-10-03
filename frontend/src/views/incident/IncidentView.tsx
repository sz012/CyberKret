import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { ActionStatus, Incident } from '../../api/types'
import { Timeline } from '../../components/Timeline'
import { Countdown, ErrorNote, Loading, Pill } from '../../components/ui'
import { useAppData, useRequiredOrg } from '../../lib/appData'
import { formatDateTime } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { NotFoundView } from '../NotFoundView'
import { ContinuityTab } from './ContinuityTab'
import { LessonsTab } from './LessonsTab'
import { PhaseStrip } from './parts'
import { SituationTab } from './SituationTab'

const TABS = [
  { id: 'sytuacja', label: 'Sytuacja', path: '' },
  { id: 'ciaglosc', label: 'Ciągłość', path: '/ciaglosc' },
  { id: 'dziennik', label: 'Dziennik', path: '/dziennik' },
  { id: 'wnioski', label: 'Wnioski', path: '/wnioski' },
]

export function IncidentView() {
  const { id = '', tab = 'sytuacja' } = useParams()
  const incidentId = Number(id)
  const valid = Number.isInteger(incidentId) && incidentId > 0 && TABS.some((item) => item.id === tab)
  const org = useRequiredOrg()
  const { reloadOrg } = useAppData()
  const navigate = useNavigate()
  const incident = useResource(() => (valid ? api.incident(incidentId) : Promise.reject(new Error('invalid'))), `incident-${id}`)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!valid) return <NotFoundView />
  if (incident.loading && !incident.data) return <Loading />
  if (!incident.data) return <ErrorNote message={incident.error ?? 'Nie udało się wczytać incydentu.'} onRetry={incident.reload} />

  const data = incident.data
  const base = `/incydenty/${data.id}`

  const mutate = async (change: () => Promise<Incident>) => {
    setPending(true)
    setError(null)
    try {
      incident.setData(await change())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  const onAnswer = (question: string, value: string) => mutate(() => api.answer(data.id, { [question]: value }))
  const onStatus = (action: string, status: ActionStatus) => mutate(() => api.setAction(data.id, action, status))
  const onConfirm = (item: string, done: boolean) => mutate(() => api.confirm(data.id, item, done))
  const onClose = async () => {
    if (!window.confirm('Zamknąć incydent? Plan i ciągłość zostaną w dzienniku, ale nie będzie można ich zmieniać.')) return
    await mutate(() => api.closeIncident(data.id))
    navigate(`${base}/wnioski`)
  }
  const onApplied = async () => {
    await reloadOrg()
    await incident.reload()
  }

  const done = data.actions.filter((action) => action.status === 'done').length

  return (
    <div className="page page--incident">
      <header className="incident-head">
        <div>
          <span className="depth-chip">5 m · incydent #{data.id}</span>
          <h1>{data.type_label}</h1>
          <p className="incident-head__meta">
            Zgłoszony {formatDateTime(data.created_at)}
            {data.closed_at && ` · zamknięty ${formatDateTime(data.closed_at)}`} · {done} z {data.actions.length} kroków
            wykonanych
          </p>
        </div>
        <div className="incident-head__side">
          <Pill tone={data.status === 'open' ? 'bad' : 'ok'} dot>
            {data.status === 'open' ? 'incydent trwa' : 'zamknięty'}
          </Pill>
          {data.clocks.map((clock) => (
            <Countdown key={clock.id} dueAt={clock.due_at} label={clock.label} />
          ))}
          {data.status === 'open' && (
            <button type="button" className="btn btn--ghost btn--small" onClick={onClose} disabled={pending}>
              Zamknij incydent
            </button>
          )}
        </div>
      </header>

      <PhaseStrip phases={data.phases} closed={data.status === 'closed'} />

      <nav className="tabs" aria-label="Widoki incydentu">
        {TABS.map((item) => (
          <NavLink key={item.id} to={`${base}${item.path}`} end className="tabs__item">
            {item.label}
            {item.id === 'ciaglosc' && !data.continuity.maintained && data.status === 'open' && (
              <span className="tabs__badge" aria-label={`brakuje ${data.continuity.missing}`}>
                {data.continuity.missing}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {error && <ErrorNote message={error} />}

      {tab === 'sytuacja' && (
        <SituationTab incident={data} org={org} pending={pending} onAnswer={onAnswer} onStatus={onStatus} />
      )}
      {tab === 'ciaglosc' && <ContinuityTab incident={data} org={org} pending={pending} onConfirm={onConfirm} />}
      {tab === 'dziennik' && (
        <section className="panel">
          <header className="panel-head">
            <span>Dziennik decyzji</span>
            <span className="panel-head__aside">każde działanie z godziną</span>
          </header>
          <div className="panel-body">
            <Timeline entries={data.log} />
          </div>
        </section>
      )}
      {tab === 'wnioski' && (
        <LessonsTab incident={data} org={org} pending={pending} onClose={onClose} onApplied={onApplied} />
      )}
    </div>
  )
}
