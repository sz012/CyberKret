import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { IncidentRow } from '../api/types'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import { ago } from '../util'

export default function Incidents() {
  const [rows, setRows] = useState<IncidentRow[] | null>(null)
  const [types, setTypes] = useState<{ id: string; label: string; ready: boolean; questions: number }[]>([])
  const [params] = useSearchParams()
  const nav = useNavigate()
  const fresh = params.get('nowy') === '1'

  useEffect(() => {
    api.incidents().then(setRows)
    api.incidentTypes().then(setTypes)
  }, [])

  const start = async (type: string) => {
    const inc = await api.createIncident(type)
    nav(`/app/incydent/${inc.id}`)
  }

  const open = rows?.filter((r) => r.status === 'open') ?? []

  return (
    <div className="incidents-page">
      <section className={`sos-hero card ${fresh ? 'pulse' : ''}`}>
        <Mascot size={150} pose="alarm" />
        <div className="stack">
          <span className="eyebrow">Funkcja 3 · Tryb incydentu</span>
          <h1>Coś się stało? Spokojnie. Kret poprowadzi.</h1>
          <p className="muted">Wybierz, co się dzieje. Kret zada kilka pytań i ułoży plan: co zrobić teraz, kto to robi i jak utrzymać pracę firmy. Wszystko działa na tym komputerze, także bez internetu.</p>
        </div>
      </section>

      {open.length > 0 && (
        <div className="card card-pad row gap wrap open-inc">
          <Icon name="alert" size={22} className="bad" />
          <b>Trwa incydent: {open[0].type_label.toLowerCase()}</b>
          <span className="muted small">zgłoszony {ago(open[0].created_at)}</span>
          <Link className="btn btn-bad btn-sm" to={`/app/incydent/${open[0].id}`}>Wróć do incydentu</Link>
        </div>
      )}

      <section>
        <h2 className="h2">Co się dzieje?</h2>
        <div className="types">
          {types.map((t) => (
            <button key={t.id} className={`type card ${t.ready ? '' : 'soon'}`} disabled={!t.ready} onClick={() => start(t.id)}>
              <b>{t.label}</b>
              <span className="muted small">{t.ready ? `Poradnik gotowy · ${t.questions} pytań` : 'w przygotowaniu'}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Podejrzany mail? Najszybciej zgłosisz go z widoku Kreta pocztowego: kret przeniesie fakty do incydentu.</p>
      </section>

      {rows && rows.length > 0 && (
        <section>
          <h2 className="h2">Historia</h2>
          <ul className="inc-list">
            {rows.map((r) => (
              <li key={r.id} className="card">
                <Link to={`/app/incydent/${r.id}`}>
                  <span className={`pill ${r.status === 'open' ? 'bad' : 'ok'}`}><span className="dot" />{r.status === 'open' ? 'trwa' : 'zamknięty'}</span>
                  <b>{r.type_label}</b>
                  <span className="muted small">{ago(r.created_at)} · {r.done} kroków zrobionych</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
