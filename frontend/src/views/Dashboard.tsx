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
      ? 'Kret jeszcze nie sprawdzał Twojej sieci.'
      : last.tunnels.length === 0
        ? 'Kret nie znalazł otwartych tuneli. Dobra robota.'
        : `Kret znalazł ${last.tunnels.length} ${plural(last.tunnels.length, 'tunel', 'tunele', 'tuneli')}. Pierwszy ruch zajmie ${last.moves[0]?.effort_min ?? 0} minut.`

  return (
    <div className="dash">
      {org?.demo && (
        <section className="card-strip card demo-strip">
          <Icon name="briefcase" size={26} className="lamp" />
          <div>
            <b>To jest firma demo: {org.name}.</b>
            <p className="muted">Wszystko działa naprawdę, ale na zmyślonych danych. Ustaw swoją firmę, a kret sprawdzi Ciebie.</p>
          </div>
          <Link className="btn btn-lamp btn-sm" to="/app/firma">Ustaw moją firmę</Link>
        </section>
      )}
      <section className="dash-hero card">
        <Mascot size={210} pose={last && last.tunnels.length === 0 ? 'happy' : 'report'} />
        <div className="dash-hero-copy">
          <span className="eyebrow">Dzień dobry{org?.name ? `, ${org.name}` : ''}</span>
          <h1>{headline}</h1>
          <p className="muted">
            Kret przegląda sieć, komputery, konta, pocztę, kopie i procedury. Mówi, którędy wszedłby atakujący i co zamknąć najpierw.
          </p>
          <div className="row gap">
            <button className="btn btn-lamp btn-lg" onClick={() => nav('/app/tunele?kop=1')}>
              {last ? 'Wpuść kreta ponownie' : 'Wpuść kreta'} ▸
            </button>
            {last && <span className="muted mono small">ostatnio {ago(last.created_at)}</span>}
          </div>
        </div>
      </section>

      <section className="tiles">
        <Link to="/app/tunele" className="tile card">
          <div className="tile-icon lamp"><Icon name="router" size={26} /></div>
          <h3>Tunele</h3>
          <p className="muted">Ścieżki, którymi atakujący dotarłby do danych klientów, pieniędzy albo zatrzymał pracę firmy.</p>
          <div className="tile-stat">
            {last ? (
              <>
                <b className={last.counts.open ? 'bad' : 'ok'}>{last.tunnels.length}</b>
                <span>{last.tunnels.length ? 'otwartych tuneli' : 'tuneli, wszystko zasypane'}</span>
              </>
            ) : (
              <span className="muted">jeszcze nie sprawdzono</span>
            )}
          </div>
        </Link>

        <Link to="/app/poczta" className="tile card">
          <div className="tile-icon net"><Icon name="mail" size={26} /></div>
          <h3>Kret pocztowy</h3>
          <p className="muted">Czyta maile, zanim otworzy je człowiek. Podejrzane załączniki otwiera u siebie w norze, jako tekst.</p>
          <div className="tile-stat">
            <b className={flagged ? 'bad' : 'ok'}>{flagged}</b>
            <span>podejrzanych{unscanned ? `, ${unscanned} czeka na kreta` : ''}</span>
          </div>
        </Link>

        <Link to={open[0] ? `/app/incydent/${open[0].id}` : '/app/incydent?nowy=1'} className={`tile card ${open.length ? 'tile-alert' : ''}`}>
          <div className="tile-icon bad"><Icon name="alert" size={26} /></div>
          <h3>Incydent</h3>
          <p className="muted">Gdy coś się stało: kilka pytań i plan dopasowany do Twojej firmy. Działa bez internetu.</p>
          <div className="tile-stat">
            {open.length ? (
              <>
                <b className="bad">{open.length}</b>
                <span>trwa: {open[0].type_label.toLowerCase()}</span>
              </>
            ) : (
              <span className="ok">spokój, brak incydentów</span>
            )}
          </div>
        </Link>
      </section>

      <section className="local-strip card">
        <Icon name="chip" size={28} className="lamp" />
        <div>
          <b>Mózg kreta działa na tym komputerze.</b>
          <p className="muted">
            {health?.llm.available
              ? `Model ${health.llm.model} przez Ollamę. Maile, wyniki skanów i odpowiedzi nie wychodzą z tego komputera.`
              : 'Model lokalny nie odpowiada. Kret działa dalej na regułach i gotowych szablonach. Instrukcja uruchomienia modelu jest w README.'}
          </p>
        </div>
        <span className="zero">0 B</span>
        <span className="muted small">wysłanych na zewnątrz</span>
      </section>

      <section className="card-strip card">
        <Icon name="printer" size={26} className="lamp" />
        <div>
          <b>Karta kreta do szuflady.</b>
          <p className="muted">Wydrukuj ją, zanim coś się stanie. Gdy padnie poczta, internet albo prąd, każdy wie, co robić i do kogo dzwonić.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/app/karta">Otwórz kartę</Link>
      </section>
    </div>
  )
}
