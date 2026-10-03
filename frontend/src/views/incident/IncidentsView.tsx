import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { Icon } from '../../components/Icon'
import { EmptyState, ErrorNote, Loading, PageHead, Pill } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import { useResource } from '../../lib/useResource'

export function IncidentsView() {
  const incidents = useResource(api.incidents, 'incidents')

  return (
    <div className="page">
      <PageHead
        depth="5 m"
        title="Incydenty"
        lead="Każdy incydent ma swój plan, tryb ciągłości i dziennik. Dziennik przydaje się później przy zgłoszeniach i analizie."
        actions={
          <Link to="/incydenty/nowy" className="btn btn--sos">
            <Icon name="siren" size={18} />
            Coś się stało
          </Link>
        }
      />
      {incidents.loading && !incidents.data ? (
        <Loading />
      ) : incidents.error ? (
        <ErrorNote message={incidents.error} onRetry={incidents.reload} />
      ) : incidents.data?.length ? (
        <ul className="incident-list">
          {incidents.data.map((incident) => (
            <li key={incident.id}>
              <Link to={`/incydenty/${incident.id}`} className="incident-card">
                <div>
                  <span className="incident-card__title">{incident.type_label}</span>
                  <span className="incident-card__meta">
                    Zgłoszony {formatDateTime(incident.created_at)}
                    {incident.closed_at && ` · zamknięty ${formatDateTime(incident.closed_at)}`}
                  </span>
                </div>
                <div className="incident-card__side">
                  <Pill tone={incident.status === 'open' ? 'bad' : 'ok'} dot>
                    {incident.status === 'open' ? 'trwa' : 'zamknięty'}
                  </Pill>
                  <span className="incident-card__progress">
                    {incident.done} z {incident.total} kroków
                  </span>
                  <span className="progress" aria-hidden="true">
                    <span style={{ width: `${incident.total ? (incident.done / incident.total) * 100 : 0}%` }} />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nie było jeszcze żadnego incydentu">
          Gdy coś się stanie, kliknij „Coś się stało”. Kret zada kilka pytań i ułoży plan.
        </EmptyState>
      )}
    </div>
  )
}
