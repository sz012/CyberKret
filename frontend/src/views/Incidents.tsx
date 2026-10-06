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
  const fresh = params.get('new') === '1'

  useEffect(() => {
    api.incidents().then(setRows)
    api.incidentTypes().then(setTypes)
  }, [])

  const start = async (type: string) => {
    const inc = await api.createIncident(type)
    nav(`/app/incident/${inc.id}`)
  }

  const open = rows?.filter((r) => r.status === 'open') ?? []

  return (
    <div className="incidents-page">
      <section className={`sos-hero card ${fresh ? 'pulse' : ''}`}>
        <Mascot size={150} pose="alarm" />
        <div className="stack">
          <span className="eyebrow">Feature 3 · Incident mode</span>
          <h1>Something happened? Stay calm. The mole will guide you.</h1>
          <p className="muted">Pick what is happening. The mole asks a few questions and builds a plan: what to do now, who does it and how to keep the business running. Everything runs on this computer, even without internet.</p>
        </div>
      </section>

      {open.length > 0 && (
        <div className="card card-pad row gap wrap open-inc">
          <Icon name="alert" size={22} className="bad" />
          <b>Incident in progress: {open[0].type_label.toLowerCase()}</b>
          <span className="muted small">reported {ago(open[0].created_at)}</span>
          <Link className="btn btn-bad btn-sm" to={`/app/incident/${open[0].id}`}>Back to the incident</Link>
        </div>
      )}

      <section>
        <h2 className="h2">What is happening?</h2>
        <div className="types">
          {types.map((t) => (
            <button key={t.id} className={`type card ${t.ready ? '' : 'soon'}`} disabled={!t.ready} onClick={() => start(t.id)}>
              <b>{t.label}</b>
              <span className="muted small">{t.ready ? `Playbook ready · ${t.questions} questions` : 'coming soon'}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Suspicious email? The fastest way is to report it from the Mail mole view: the mole carries the facts into the incident.</p>
      </section>

      {rows && rows.length > 0 && (
        <section>
          <h2 className="h2">History</h2>
          <ul className="inc-list">
            {rows.map((r) => (
              <li key={r.id} className="card">
                <Link to={`/app/incident/${r.id}`}>
                  <span className={`pill ${r.status === 'open' ? 'bad' : 'ok'}`}><span className="dot" />{r.status === 'open' ? 'open' : 'closed'}</span>
                  <b>{r.type_label}</b>
                  <span className="muted small">{ago(r.created_at)} · {r.done} steps done</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
