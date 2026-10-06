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
        <span className="demo-window-brand"><BrandMark size={21} /> Nowak Law Office</span>
        <div className="demo-window-tabs" aria-hidden="true">
          {['Dashboard', 'Tunnels', 'Mail mole', 'Incident'].map((label) => <span key={label} className={active === label ? 'active' : ''}>{label}</span>)}
        </div>
        <span className="demo-local"><span /> local</span>
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
        <p className="demo-chapter">01 / Your company</p>
        <h1>A small company.<br /><em>A big responsibility.</em></h1>
        <p>Client files. Payments. Deadlines.<br />And no IT department on site.</p>
        <div className="demo-story-note"><Icon name="briefcase" /> Meet Nowak Law Office.</div>
      </div>
      <AppFrame active="Dashboard">
        <div className="demo-company-hero">
          <Mascot size={155} pose="report" />
          <div><p>Nowak Law Office</p><h2>Where do<br />we start?</h2><span className="demo-firm-size">8 people · law office</span></div>
        </div>
        <div className="demo-company-assets">
          {org.targets.map((target, i) => <div key={target.id}><Icon name={['folder', 'money', 'briefcase'][i]} size={27} /><strong>{target.label}</strong><span>{target.harm}</span></div>)}
        </div>
        <div className="demo-window-foot"><Icon name="shield" size={17} /> First check what needs attention.</div>
      </AppFrame>
    </div>
  )

  if (id === 'tunnels' || id === 'fix') return (
    <div className="demo-scene demo-split demo-map-scene" key={id}>
      <div className="demo-story">
        <p className="demo-chapter">{id === 'fix' ? '03 / First move' : '02 / Attack path'}</p>
        <h1>{id === 'fix' ? <>You know where<br /><em>to start.</em></> : <>This is how someone<br /><em>reaches your data.</em></>}</h1>
        {id === 'tunnels' ? <>
          <p>The mole links weak spots into concrete attack paths.</p>
          <div className="demo-route">
            <span><Icon name="globe" size={18} /> Internet</span>
            {route.steps.map((step, i) => <span key={step.technique} className={progress > (i + 1) * 0.16 ? 'revealed' : ''}><i />{step.to_label}</span>)}
          </div>
          <small className="demo-evidence-note">Result of the threat model based on the demo company's safeguards.</small>
        </> : <>
          <p>{first.label}.</p>
          <div className="demo-move"><span><Icon name="clock" /> {first.effort_min} minutes</span><span>{first.cost}</span></div>
          <div className={`demo-impact ${fixed ? 'resolved' : ''}`}>
            <b>{fixed ? after.tunnels.length : before.tunnels.length}</b>
            <span>{fixed ? 'paths left to close' : 'attack paths before the change'}</span>
          </div>
          <p className="demo-evidence-note">Simulation after applying the advice. The mole does not change the router's settings.</p>
        </>}
      </div>
      <AppFrame active="Tunnels">
        <div className="demo-map-heading"><span>{fixed ? 'After the first change' : 'Threat map'}</span><b className={fixed ? 'ok' : 'bad'}>{run.tunnels.length} {plural(run.tunnels.length, 'tunnel', 'tunnels')}</b></div>
        <Map org={org} run={run} selected={fixed ? null : route.id} />
        <div className={`demo-window-foot ${fixed ? 'ok' : ''}`}><Icon name={fixed ? 'check' : 'key'} size={17} />{fixed ? `${first.closes.length} attack paths closed with one move.` : 'Network, computers, accounts, email, backups and procedures.'}</div>
      </AppFrame>
    </div>
  )

  if (id === 'mail') {
    const types = ['lookalike_sender', 'account_change', 'double_extension']
    const signals = types.map((type) => mail.indicators.find((signal) => signal.type === type)).filter((signal) => signal !== undefined)
    return (
      <div className="demo-scene demo-split" key={id}>
        <div className="demo-story">
          <p className="demo-chapter">04 / Mail mole</p>
          <h1>It looks like an invoice.<br /><em>It is a scam.</em></h1>
          <p>The mole points to concrete signs before anyone sends money.</p>
          <div className="demo-signals">
            {signals.map((signal, i) => <div key={signal.type} className={progress >= i * 0.18 ? 'revealed' : ''}><span>0{i + 1}</span><p><strong>{signal.title}</strong><small>{signal.quote || signal.detail}</small></p></div>)}
          </div>
        </div>
        <AppFrame active="Mail mole">
          <div className="demo-mail-header"><span className="demo-mail-avatar">B</span><div><b>{mail.mail.from_name}</b><span>{mail.mail.from_addr}</span></div><Icon name="mail" /></div>
          <div className="demo-mail-body">
            <h2>{mail.mail.subject}</h2>
            <p>Dear Grace,</p>
            <p>as we have changed banks, please pay invoice FV/09/2026 to our <mark className={progress > 0.18 ? 'lit' : ''}>new account number</mark>.</p>
            <p>The payment is urgent, please complete it by the end of the day.</p>
            <div className={`demo-attachment ${progress > 0.36 ? 'flagged' : ''}`}><Icon name="paperclip" /><span>invoice_FV-09-2026.pdf<b>.html</b></span></div>
          </div>
          <div className={`demo-verdict ${progress > 0.52 ? 'revealed' : ''}`}><Icon name="alert" size={25} /><div><strong>{mail.label}</strong><p>{mail.what_to_do}</p></div></div>
        </AppFrame>
      </div>
    )
  }

  if (id === 'incident') return (
    <div className="demo-scene demo-split" key={id}>
      <div className="demo-story">
        <p className="demo-chapter">05 / Action plan</p>
        <h1>Everyone knows<br /><em>what to do next.</em></h1>
        <p>A few answers. Concrete tasks.<br />Assigned to people in your company.</p>
        <div className="demo-answer"><span>Has the payment gone out yet?</span><b><Icon name="check" size={18} /> No</b></div>
        <small className="demo-evidence-note">The plan takes the answers from this scenario into account.</small>
      </div>
      <AppFrame active="Incident">
        <div className="demo-plan-title"><Icon name="shield" size={29} /><div><h2>Stop. Check. Act.</h2><span>Suspicious invoice · first steps</span></div></div>
        <div className="demo-actions">
          {situation.plan.slice(0, 3).map((action, i) => <div key={action.id} className={progress >= i * 0.15 ? 'revealed' : ''}><span className="demo-action-index">{i + 1}</span><div><span className="demo-owner">{action.role_label} · now</span><h3>{action.title}</h3><p>{action.detail}</p></div></div>)}
        </div>
        <div className="demo-window-foot"><Icon name="phone" size={17} /> The vendor's number from the contract, not from the suspicious email.</div>
      </AppFrame>
    </div>
  )

  return (
    <div className="demo-scene demo-finale" key={id}>
      <div className="demo-finale-orbit" aria-hidden="true"><span /><span /><span /></div>
      <div className="demo-finale-brand"><BrandMark size={86} /><Wordmark /></div>
      <h1>Better your own mole<br /><em>gets in first.</em></h1>
      <p>See the threat. Set priorities. Act.</p>
      <div className="demo-private"><Icon name="chip" size={21} /><span>Analysis runs locally. Company data stays on your computer.</span></div>
      <Link className="btn btn-lamp btn-lg demo-end-link" to="/app">Open the app <span aria-hidden="true">↗</span></Link>
    </div>
  )
}
