import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { Analysis, KretRun, MailMessage, Org, Situation } from '../api/types'
import { BrandMark, Wordmark } from '../components/BrandMark'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import TunnelMap from '../components/TunnelMap'
import KretFilm from '../landing/film/KretFilm'
import { END } from '../landing/film/timeline'
import { plural } from '../util'

export interface Presentation {
  org: Org
  before: Omit<KretRun, 'id' | 'created_at' | 'label'>
  after: Omit<KretRun, 'id' | 'created_at' | 'label'>
  mail: Analysis & { mail: MailMessage }
  situation: Situation
}

const Map = memo(TunnelMap)

function AppFrame({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="demo-window">
      <div className="demo-window-top">
        <span className="demo-window-brand"><BrandMark size={21} /> Kancelaria Nowak</span>
        <div className="demo-window-tabs" aria-hidden="true">
          {['Pulpit', 'Tunele', 'Kret pocztowy', 'Incydent'].map((label) => <span key={label} className={active === label ? 'active' : ''}>{label}</span>)}
        </div>
        <span className="demo-local"><span /> lokalnie</span>
      </div>
      {children}
    </div>
  )
}

export default function DemoScenes({ id, progress, data }: { id: string; progress: number; data: Presentation }) {
  const { org, before, after, mail, situation } = data
  const first = before.moves[0]
  const route = before.tunnels.find((tunnel) => tunnel.target === 'client_data_read' && tunnel.state === 'open') ?? before.tunnels[0]
  const fixed = id === 'fix' && progress >= 0.48
  const run = fixed ? after : before

  if (id === 'intro') return <KretFilm time={Math.min(END, progress * 18000)} presentation />

  if (id === 'company') return (
    <div className="demo-scene demo-split" key={id}>
      <div className="demo-story">
        <p className="demo-chapter">01 / Twoja firma</p>
        <h1>Mała firma.<br /><em>Duża odpowiedzialność.</em></h1>
        <p>Akta klientów. Płatności. Terminy.<br />A na miejscu nie ma działu IT.</p>
        <div className="demo-story-note"><Icon name="briefcase" /> Poznaj Kancelarię Nowak.</div>
      </div>
      <AppFrame active="Pulpit">
        <div className="demo-company-hero">
          <Mascot size={155} pose="report" />
          <div><p>Kancelaria Nowak</p><h2>Od czego<br />zaczniemy?</h2><span className="demo-firm-size">8 osób · kancelaria prawna</span></div>
        </div>
        <div className="demo-company-assets">
          {org.targets.map((target, i) => <div key={target.id}><Icon name={['folder', 'money', 'briefcase'][i]} size={27} /><strong>{target.label}</strong><span>{target.harm}</span></div>)}
        </div>
        <div className="demo-window-foot"><Icon name="shield" size={17} /> Najpierw sprawdź, co wymaga uwagi.</div>
      </AppFrame>
    </div>
  )

  if (id === 'tunnels' || id === 'fix') return (
    <div className="demo-scene demo-split demo-map-scene" key={id}>
      <div className="demo-story">
        <p className="demo-chapter">{id === 'fix' ? '03 / Pierwszy ruch' : '02 / Droga ataku'}</p>
        <h1>{id === 'fix' ? <>Wiesz, od czego<br /><em>zacząć.</em></> : <>Tak można dotrzeć<br /><em>do Twoich danych.</em></>}</h1>
        {id === 'tunnels' ? <>
          <p>Kret łączy słabe punkty w konkretne drogi ataku.</p>
          <div className="demo-route">
            <span><Icon name="globe" size={18} /> Internet</span>
            {route.steps.map((step, i) => <span key={step.technique} className={progress > (i + 1) * 0.16 ? 'revealed' : ''}><i />{step.to_label}</span>)}
          </div>
          <small className="demo-evidence-note">Wynik modelu zagrożeń na podstawie zabezpieczeń firmy demo.</small>
        </> : <>
          <p>{first.label}.</p>
          <div className="demo-move"><span><Icon name="clock" /> {first.effort_min} minut</span><span>{first.cost}</span></div>
          <div className={`demo-impact ${fixed ? 'resolved' : ''}`}>
            <b>{fixed ? after.tunnels.length : before.tunnels.length}</b>
            <span>{fixed ? 'drogi pozostają do zamknięcia' : 'dróg ataku przed zmianą'}</span>
          </div>
          <p className="demo-evidence-note">Symulacja po wdrożeniu zalecenia. Kret nie zmienia ustawień routera.</p>
        </>}
      </div>
      <AppFrame active="Tunele">
        <div className="demo-map-heading"><span>{fixed ? 'Po pierwszej zmianie' : 'Mapa zagrożeń'}</span><b className={fixed ? 'ok' : 'bad'}>{run.tunnels.length} {plural(run.tunnels.length, 'tunel', 'tunele', 'tuneli')}</b></div>
        <Map org={org} run={run} selected={fixed ? null : route.id} />
        <div className={`demo-window-foot ${fixed ? 'ok' : ''}`}><Icon name={fixed ? 'check' : 'key'} size={17} />{fixed ? `${first.closes.length} drogi ataku zamknięte jednym ruchem.` : 'Sieć, komputery, konta, poczta, kopie i procedury.'}</div>
      </AppFrame>
    </div>
  )

  if (id === 'mail') {
    const types = ['lookalike_sender', 'account_change', 'double_extension']
    const signals = types.map((type) => mail.indicators.find((signal) => signal.type === type)).filter((signal) => signal !== undefined)
    return (
      <div className="demo-scene demo-split" key={id}>
        <div className="demo-story">
          <p className="demo-chapter">04 / Kret pocztowy</p>
          <h1>Wygląda jak faktura.<br /><em>Jest próbą oszustwa.</em></h1>
          <p>Kret wskazuje konkretne sygnały, zanim ktoś wykona przelew.</p>
          <div className="demo-signals">
            {signals.map((signal, i) => <div key={signal.type} className={progress >= i * 0.18 ? 'revealed' : ''}><span>0{i + 1}</span><p><strong>{signal.title}</strong><small>{signal.quote || signal.detail}</small></p></div>)}
          </div>
        </div>
        <AppFrame active="Kret pocztowy">
          <div className="demo-mail-header"><span className="demo-mail-avatar">B</span><div><b>{mail.mail.from_name}</b><span>{mail.mail.from_addr}</span></div><Icon name="mail" /></div>
          <div className="demo-mail-body">
            <h2>{mail.mail.subject}</h2>
            <p>Dzień dobry Pani Grażyno,</p>
            <p>w związku ze zmianą banku prosimy o przelew za fakturę FV/09/2026 na <mark className={progress > 0.18 ? 'lit' : ''}>nowy numer rachunku</mark>.</p>
            <p>Płatność jest pilna, prosimy o realizację do końca dnia.</p>
            <div className={`demo-attachment ${progress > 0.36 ? 'flagged' : ''}`}><Icon name="paperclip" /><span>faktura_FV-09-2026.pdf<b>.html</b></span></div>
          </div>
          <div className={`demo-verdict ${progress > 0.52 ? 'revealed' : ''}`}><Icon name="alert" size={25} /><div><strong>{mail.label}</strong><p>{mail.what_to_do}</p></div></div>
        </AppFrame>
      </div>
    )
  }

  if (id === 'incident') return (
    <div className="demo-scene demo-split" key={id}>
      <div className="demo-story">
        <p className="demo-chapter">05 / Plan działania</p>
        <h1>Każdy wie,<br /><em>co robić dalej.</em></h1>
        <p>Kilka odpowiedzi. Konkretne zadania.<br />Przypisane do osób w Twojej firmie.</p>
        <div className="demo-answer"><span>Czy przelew już wyszedł?</span><b><Icon name="check" size={18} /> Nie</b></div>
        <small className="demo-evidence-note">Plan uwzględnia odpowiedzi z tego scenariusza.</small>
      </div>
      <AppFrame active="Incydent">
        <div className="demo-plan-title"><Icon name="shield" size={29} /><div><h2>Zatrzymaj. Sprawdź. Działaj.</h2><span>Podejrzana faktura · pierwsze kroki</span></div></div>
        <div className="demo-actions">
          {situation.plan.slice(0, 3).map((action, i) => <div key={action.id} className={progress >= i * 0.15 ? 'revealed' : ''}><span className="demo-action-index">{i + 1}</span><div><span className="demo-owner">{action.role_label} · teraz</span><h3>{action.title}</h3><p>{action.detail}</p></div></div>)}
        </div>
        <div className="demo-window-foot"><Icon name="phone" size={17} /> Numer kontrahenta z umowy, nie z podejrzanego maila.</div>
      </AppFrame>
    </div>
  )

  return (
    <div className="demo-scene demo-finale" key={id}>
      <div className="demo-finale-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div className="demo-finale-brand"><BrandMark size={86} /><Wordmark /></div>
      <h1>Lepiej, żeby pierwszy<br />był <em>Twój kret.</em></h1>
      <p>Zobacz zagrożenie. Ustal priorytety. Działaj.</p>
      <div className="demo-private"><Icon name="chip" size={21} /><span>Analiza lokalnie. Dane firmy na Twoim komputerze.</span></div>
      <Link className="btn btn-lamp btn-lg demo-end-link" to="/app">Otwórz aplikację <span aria-hidden="true">↗</span></Link>
    </div>
  )
}
