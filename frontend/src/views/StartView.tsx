import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import { Icon } from '../components/Icon'
import { Mascot } from '../components/Mascot'
import { Timeline } from '../components/Timeline'
import { ErrorNote, Panel, Pill } from '../components/ui'
import { useAppData, useRequiredOrg } from '../lib/appData'
import { countLabel, formatDateTime, formatTime } from '../lib/format'
import { useResource } from '../lib/useResource'

export function StartView() {
  const { setOrg, health } = useAppData()
  const org = useRequiredOrg()
  const kret = useResource(api.latestKret, 'start-kret')
  const incidents = useResource(api.incidents, 'start-incidents')
  const log = useResource(() => api.log(8), 'start-log')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const active = incidents.data?.filter((incident) => incident.status === 'open') ?? []
  const latest = kret.data

  const reset = async () => {
    if (!window.confirm('Przywrócić dane demonstracyjne? Incydenty, wyniki kreta i dziennik zostaną usunięte.')) return
    setResetting(true)
    setResetError(null)
    try {
      setOrg(await api.resetDemo())
      await Promise.all([kret.reload(), incidents.reload(), log.reload()])
    } catch (caught) {
      setResetError(errorMessage(caught))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="page page--start">
      <section className="hero">
        <div className="hero__copy">
          <Pill tone="lamp" dot>
            {org.today_note}
          </Pill>
          <h1>
            Lepiej, żeby pierwszy był <em>Twój kret.</em>
          </h1>
          <p className="lead">
            <strong>{org.name}.</strong> {org.description}
          </p>
          <p className="lead">
            Kret pokazuje, którędy wszedłby atakujący i co zamknąć najpierw. Gdy coś się stanie, prowadzi przez
            incydent tak, żeby praca nie stanęła.
          </p>
          <div className="hero__actions">
            <Link className="btn btn--lamp" to="/kret?kop=1">
              Wpuść kreta
              <Icon name="arrow" size={17} />
            </Link>
            <Link className="btn btn--ghost" to="/poczta">
              Sprawdź podejrzaną wiadomość
            </Link>
          </div>
        </div>
        <div className="hero__art">
          <Mascot mood="calm" className="hero__mole" title="Kret w żółtym kasku z czołówką" />
        </div>
      </section>

      <div className="tiles">
        <Panel
          title="Tunele"
          aside={latest ? `kopał o ${formatTime(latest.created_at)}` : 'jeszcze nie kopał'}
          className="tile"
        >
          <div className="tile__body">
            {kret.error ? (
              <ErrorNote message={kret.error} onRetry={kret.reload} />
            ) : latest ? (
              <>
                <p className={`tile__number tile__number--${latest.total ? 'bad' : 'ok'}`}>{latest.total}</p>
                <p className="tile__caption">
                  {latest.total
                    ? `${countLabel(latest.total, 'otwarta droga', 'otwarte drogi', 'otwartych dróg')} do tego, co cenne`
                    : 'Kret nie znalazł otwartej drogi.'}
                </p>
                {latest.moves[0] && (
                  <p className="tile__hint">
                    Zacznijcie od: <strong>{latest.moves[0].fix}</strong>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="tile__number tile__number--muted">?</p>
                <p className="tile__caption">Wpuśćcie kreta, żeby zobaczyć, którędy da się wejść do biura.</p>
              </>
            )}
          </div>
          <div className="tile__foot">
            <Link className="btn btn--ghost btn--small" to="/kret">
              Zobacz mapę tuneli
            </Link>
          </div>
        </Panel>

        <Panel title="Incydenty" aside={active.length ? `${active.length} otwarte` : 'spokojnie'} className="tile">
          <div className="tile__body">
            {incidents.error ? (
              <ErrorNote message={incidents.error} onRetry={incidents.reload} />
            ) : active.length ? (
              <ul className="tile__list">
                {active.slice(0, 3).map((incident) => (
                  <li key={incident.id}>
                    <Link to={`/incydenty/${incident.id}`} className="incident-link">
                      <span className="incident-link__title">{incident.type_label}</span>
                      <span className="incident-link__meta">
                        od {formatDateTime(incident.created_at)} · {incident.done} z {incident.total} kroków
                      </span>
                      <span className="progress" aria-hidden="true">
                        <span style={{ width: `${incident.total ? (incident.done / incident.total) * 100 : 0}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="tile__number tile__number--ok">0</p>
                <p className="tile__caption">Nie ma otwartych incydentów. Gdy coś się stanie, zacznij tutaj.</p>
              </>
            )}
          </div>
          <div className="tile__foot">
            <Link className="btn btn--sos btn--small" to="/incydenty/nowy">
              <Icon name="siren" size={15} />
              Coś się stało
            </Link>
          </div>
        </Panel>

        <Panel title="Kret pocztowy" aside={health?.llm.available ? 'model lokalny' : 'reguły'} className="tile">
          <div className="tile__body">
            <p className="tile__caption tile__caption--first">
              Dostaliście maila z prośbą o przelew albo zmianę rachunku? Wklejcie go. Kret oceni wiadomość na tym
              komputerze.
            </p>
            <p className="tile__zero">
              <span>0 bajtów</span> trafia do chmury.
            </p>
          </div>
          <div className="tile__foot">
            <Link className="btn btn--ghost btn--small" to="/poczta">
              Sprawdź wiadomość
            </Link>
          </div>
        </Panel>
      </div>

      <Panel title="Dziennik" aside="ostatnie zdarzenia">
        <div className="panel-body">
          {log.error ? (
            <ErrorNote message={log.error} onRetry={log.reload} />
          ) : (
            <Timeline entries={log.data ?? []} empty="Nic się jeszcze nie wydarzyło." />
          )}
        </div>
      </Panel>

      <footer className="page-foot">
        <span>Dane w demo są fikcyjne. Biuro, osoby, domena i numery nie istnieją.</span>
        <button type="button" className="btn btn--quiet" onClick={reset} disabled={resetting}>
          <Icon name="refresh" size={15} />
          {resetting ? 'Przywracam…' : 'Przywróć dane demonstracyjne'}
        </button>
      </footer>
      {resetError && <ErrorNote message={resetError} />}
    </div>
  )
}
