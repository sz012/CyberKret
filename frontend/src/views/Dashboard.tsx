import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { IncidentRow, KretRun, MailRow } from '../api/types'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import { useOrg } from '../components/orgContext'
import { useHealth } from '../components/useHealth'
import { ago, plural } from '../util'

export default function Dashboard() {
  const [runs, setRuns] = useState<KretRun[] | null>(null)
  const [mail, setMail] = useState<MailRow[] | null>(null)
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null)
  const health = useHealth()
  const { org } = useOrg()
  const nav = useNavigate()

  useEffect(() => {
    api.runs().then(setRuns)
    api.inbox().then((x) => setMail(x.messages))
    api.incidents().then(setIncidents)
  }, [])

  const last = runs?.[0]
  const open = incidents?.filter((i) => i.status === 'open') ?? []
  const flagged = mail?.filter((m) => m.scan && m.scan.verdict !== 'safe').length ?? 0
  const unscanned = mail?.filter((m) => !m.scan).length ?? 0

  const headline = !runs
    ? '…'
    : !last
      ? 'The mole has not checked your network yet.'
      : last.tunnels.length === 0
        ? 'The mole found no open tunnels. Good job.'
        : `The mole found ${last.tunnels.length} ${plural(last.tunnels.length, 'tunnel', 'tunnels')}. The first move takes ${last.moves[0]?.effort_min ?? 0} minutes.`

  return (
    <div className="dash">
      {org?.demo && (
        <section className="card-strip card demo-strip">
          <Icon name="briefcase" size={26} className="lamp" />
          <div>
            <b>This is a demo company: {org.name}.</b>
            <p className="muted">Everything really works, but on made-up data. Set up your own company and the mole will check you.</p>
          </div>
          <Link className="btn btn-lamp btn-sm" to="/app/company">Set up my company</Link>
        </section>
      )}
      <section className="dash-hero card">
        <Mascot size={210} pose={last && last.tunnels.length === 0 ? 'happy' : 'report'} />
        <div className="dash-hero-copy">
          <span className="eyebrow">Hello{org?.name ? `, ${org.name}` : ''}</span>
          <h1>{headline}</h1>
          <p className="muted">
            The mole goes through the network, computers, accounts, email, backups and procedures. It shows how an attacker would get in and what to close first.
          </p>
          <div className="row gap">
            <button className="btn btn-lamp btn-lg" onClick={() => nav('/app/tunnels?dig=1')}>
              {last ? 'Send the mole in again' : 'Send the mole in'} ▸
            </button>
            {last && <span className="muted mono small">last run {ago(last.created_at)}</span>}
          </div>
        </div>
      </section>

      <section className="tiles">
        <Link to="/app/tunnels" className="tile card">
          <div className="tile-icon lamp"><Icon name="router" size={26} /></div>
          <h3>Tunnels</h3>
          <p className="muted">Paths an attacker would take to client data or money, or to bring the business to a halt.</p>
          <div className="tile-stat">
            {last ? (
              <>
                <b className={last.counts.open ? 'bad' : 'ok'}>{last.tunnels.length}</b>
                <span>{last.tunnels.length ? 'open tunnels' : 'tunnels, all filled in'}</span>
              </>
            ) : (
              <span className="muted">not checked yet</span>
            )}
          </div>
        </Link>

        <Link to="/app/mail" className="tile card">
          <div className="tile-icon net"><Icon name="mail" size={26} /></div>
          <h3>Mail mole</h3>
          <p className="muted">Reads emails before a person opens them. It opens suspicious attachments in its own burrow, as plain text.</p>
          <div className="tile-stat">
            <b className={flagged ? 'bad' : 'ok'}>{flagged}</b>
            <span>suspicious{unscanned ? `, ${unscanned} waiting for the mole` : ''}</span>
          </div>
        </Link>

        <Link to={open[0] ? `/app/incident/${open[0].id}` : '/app/incident?new=1'} className={`tile card ${open.length ? 'tile-alert' : ''}`}>
          <div className="tile-icon bad"><Icon name="alert" size={26} /></div>
          <h3>Incident</h3>
          <p className="muted">When something happens: a few questions and a plan that fits your company. Works without internet.</p>
          <div className="tile-stat">
            {open.length ? (
              <>
                <b className="bad">{open.length}</b>
                <span>open: {open[0].type_label.toLowerCase()}</span>
              </>
            ) : (
              <span className="ok">all quiet, no incidents</span>
            )}
          </div>
        </Link>
      </section>

      <section className="local-strip card">
        <Icon name="chip" size={28} className="lamp" />
        <div>
          <b>The mole's brain runs on this computer.</b>
          <p className="muted">
            {health?.llm.available
              ? `Model ${health.llm.model} through Ollama. Emails, scan results and answers never leave this computer.`
              : 'The local model is not responding. The mole keeps working on rules and ready templates. The README explains how to start the model.'}
          </p>
        </div>
        <span className="zero">0 B</span>
        <span className="muted small">sent outside</span>
      </section>

      <section className="card-strip card">
        <Icon name="printer" size={26} className="lamp" />
        <div>
          <b>The mole card for your drawer.</b>
          <p className="muted">Print it before anything happens. When email, internet or power goes down, everyone knows what to do and whom to call.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/app/card">Open the card</Link>
      </section>
    </div>
  )
}
