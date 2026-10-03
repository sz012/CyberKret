import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Action, Incident, KretRun, Org } from '../api/types'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import PhaseStrip from '../components/PhaseStrip'
import TunnelMap from '../components/TunnelMap'
import { clock, time } from '../util'

const LEVEL = { likely: 'prawdopodobne', possible: 'możliwe', unlikely: 'mało prawdopodobne' }
const NEXT_STATUS: Record<string, Action['status']> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
const STATUS_LABEL: Record<string, string> = { todo: 'do zrobienia', in_progress: 'w toku', done: 'zrobione' }
const CONT_LABEL: Record<string, string> = { ok: 'działa', fallback: 'działa awaryjnie', paused: 'w trakcie', at_risk: 'zagrożone' }

export default function IncidentView() {
  const { id } = useParams()
  const iid = Number(id)
  const nav = useNavigate()
  const [inc, setInc] = useState<Incident | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [run, setRun] = useState<KretRun | null>(null)
  const [brief, setBrief] = useState<{ brief: string; next: string; llm: { model: string | null; ms: number | null } } | null>(null)
  const [briefBusy, setBriefBusy] = useState(false)
  const [diff, setDiff] = useState<{ added: string[]; removed: string[] } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [lessons, setLessons] = useState<string[]>([])
  const [allFacts, setAllFacts] = useState(false)
  const briefSeq = useRef(0)

  const loadBrief = () => {
    const my = ++briefSeq.current
    setBriefBusy(true)
    api.brief(iid).then((b) => my === briefSeq.current && setBrief(b)).finally(() => my === briefSeq.current && setBriefBusy(false))
  }

  useEffect(() => {
    api.incident(iid).then((x) => {
      setInc(x)
      setLessons(x.situation.lessons.filter((l) => l.state !== 'present').map((l) => l.id))
    })
    api.org().then(setOrg)
    api.runs().then((r) => setRun(r[0] ?? null))
    loadBrief()
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iid])

  if (!inc || !org) return <p className="muted">Ładowanie incydentu…</p>
  const s = inc.situation
  const closed = inc.status === 'closed'

  const answer = async (q: string, v: string) => {
    const before = new Map(s.plan.map((a) => [a.id, a.title]))
    const next = await api.answer(iid, { [q]: v })
    const after = new Map(next.situation.plan.map((a) => [a.id, a.title]))
    const added = [...after].filter(([k]) => !before.has(k)).map(([, t]) => t)
    const removed = [...before].filter(([k]) => !after.has(k)).map(([, t]) => t)
    setInc(next)
    if (added.length || removed.length) {
      setDiff({ added, removed })
      setTimeout(() => setDiff(null), 9000)
    }
    loadBrief()
  }
  const cycle = async (a: Action) => setInc(await api.actionStatus(iid, a.id, NEXT_STATUS[a.status]))
  const confirm = async (cid: string, done: boolean) => setInc(await api.confirm(iid, cid, done))
  const close = async () => {
    if (!window.confirm('Zamknąć incydent? Kret zaproponuje, co zasypać, żeby to się nie powtórzyło.')) return
    setInc(await api.closeIncident(iid))
  }
  const fill = async () => {
    await api.applySafeguards(lessons)
    nav('/app/tunele?kop=1&label=po%20incydencie')
  }

  const started = new Date(inc.created_at).getTime()
  const uodoLeft = s.uodo ? new Date(s.uodo.deadline).getTime() - now : null
  const groups = (['now', '15min', '1h', 'verify'] as const).map((p) => ({ p, items: s.plan.filter((a) => a.priority === p) })).filter((g) => g.items.length)
  const doneCount = s.plan.filter((a) => a.status === 'done').length

  return (
    <div className="incident-page">
      <header className={`inc-head card ${closed ? 'closed' : 'live'}`}>
        <div className="stack">
          <span className="eyebrow">{closed ? 'Incydent zamknięty' : 'Incydent trwa'} · #{inc.id}</span>
          <h1>{s.type_label}</h1>
          <div className="row gap wrap">
            <span className="pill lamp"><Icon name="clock" size={14} /> {closed ? `zamknięty ${time(inc.closed_at!)}` : `trwa ${clock(now - started)}`}</span>
            <span className="pill muted">{doneCount} z {s.plan.length} kroków zrobionych</span>
            <span className="pill ok"><Icon name="wifiOff" size={14} /> działa bez internetu</span>
          </div>
        </div>
        <div className="inc-head-right">
          {uodoLeft !== null && (
            <div className="uodo">
              <span className="eyebrow bad">Zgłoszenie do UODO</span>
              <b className="mono">{clock(uodoLeft)}</b>
              <span className="muted small">72 h od stwierdzenia naruszenia</span>
            </div>
          )}
          {!closed && <button className="btn btn-ghost btn-sm" onClick={close}>Zamknij incydent</button>}
        </div>
      </header>

      <PhaseStrip phases={s.phases} closed={closed} />

      <section className="brief card">
        <Mascot size={96} pose="report" />
        <div>
          <div className="row gap-sm">
            <h3>Odprawa od kreta</h3>
            <span className={`src ${brief?.llm.model ? 'model' : ''}`}>{briefBusy ? 'model myśli…' : brief?.llm.model ? `${brief.llm.model} · lokalnie` : 'szablon'}</span>
          </div>
          {brief ? (
            <>
              <p>{brief.brief}</p>
              {brief.next && <p className="story-next">Teraz najważniejsze: {brief.next}</p>}
            </>
          ) : (
            <p className="muted thinking">Kret układa odprawę…</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="h2">Co wiemy? <span className="muted h2-sub">„Nie wiem jeszcze” też jest odpowiedzią. Plan zmieni się po każdym nowym fakcie.</span></h2>
        <div className="questions">
          {s.questions.map((q) => (
            <div key={q.id} className={`q card ${q.answer ? '' : 'unanswered'}`}>
              <b>{q.text}</b>
              <div className="chips">
                {q.options.map((o) => (
                  <button key={o.value} className={`chip ${q.answer === o.value ? 'on' : ''}`} disabled={closed} onClick={() => answer(q.id, o.value)}>{o.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {diff && (
        <div className="diff card" role="status">
          <Icon name="alert" size={18} className="lamp" />
          <div>
            <b>Nowy fakt, plan przebudowany: +{diff.added.length}, −{diff.removed.length}.</b>
            {diff.added.length > 0 && <p className="ok small">Dochodzi: {diff.added.join('; ')}</p>}
            {diff.removed.length > 0 && <p className="muted small">Odpada: {diff.removed.join('; ')}</p>}
          </div>
        </div>
      )}

      <section className="three">
        <div className="col card">
          <div className="card-head"><h3>Potwierdzone</h3><span className="pill ok">{s.confirmed.length}</span></div>
          <ul className="facts">
            {(allFacts ? s.confirmed : [...s.confirmed.filter((f) => f.source !== 'kret pocztowy'), ...s.confirmed.filter((f) => f.source === 'kret pocztowy').slice(0, 3)]).map((f, i) => (
              <li key={i}><span>{f.text}</span><span className={`src ${f.source === 'kret pocztowy' ? 'kret' : ''}`}>{f.source}</span></li>
            ))}
            {!allFacts && s.confirmed.filter((f) => f.source === 'kret pocztowy').length > 3 && (
              <li><button className="btn btn-ghost btn-sm" onClick={() => setAllFacts(true)}>Pokaż wszystkie sygnały z maila ({s.confirmed.filter((f) => f.source === 'kret pocztowy').length})</button></li>
            )}
            {!s.confirmed.length && <li className="muted">Jeszcze nic.</li>}
          </ul>
        </div>
        <div className="col card">
          <div className="card-head"><h3>Niezweryfikowane</h3><span className="pill warn">{s.unverified.length}</span></div>
          <ul className="facts">
            {s.unverified.map((f, i) => <li key={i}><span>{f.text}</span><span className="src unverified">{f.source}</span></li>)}
            {!s.unverified.length && <li className="muted">Wszystko ustalone.</li>}
          </ul>
        </div>
        <div className="col card act-now">
          <div className="card-head"><h3>Działaj teraz</h3><span className="muted small">bezpieczne bez względu na przyczynę</span></div>
          <ul className="actions">
            {s.act_now.map((a) => <ActionItem key={a.id} a={a} onClick={() => cycle(a)} disabled={closed} />)}
          </ul>
        </div>
      </section>

      <section className="hyps">
        {Object.entries(s.hypotheses).map(([k, h]) => (
          <div key={k} className={`hyp card lvl-${h.level}`}>
            <div className="row gap-sm between">
              <h3>{h.label}</h3>
              <span className={`pill ${h.level === 'likely' ? 'bad' : h.level === 'possible' ? 'warn' : 'muted'}`}>{LEVEL[h.level]}</span>
            </div>
            <div className="meter"><i style={{ width: h.level === 'likely' ? '85%' : h.level === 'possible' ? '50%' : '12%' }} /></div>
            <p className="muted small">{h.explain}</p>
            {h.because.length > 0 && <p className="small">Bo: {h.because.join('; ')}.</p>}
            {h.kret_warned && <p className="warned"><Mascot size={34} pose="report" badge={false} cable={false} /> {h.kret_warned}</p>}
          </div>
        ))}
      </section>

      <section className="impact">
        <h2 className="h2">Co jest zagrożone</h2>
        <div className="impact-grid">
          <div className="card map-wrap">
            <TunnelMap org={org} run={run} impact={closed ? null : s.map} compact />
          </div>
          <div className="card card-pad stack">
            <b>Poczta i konta: niezaufane.</b>
            <p className="muted small">Dopóki informatyk nie potwierdzi, że skrzynka jest czysta, nie potwierdzamy niczego mailem.</p>
            <b>Kanały zastępcze, ustalone wcześniej:</b>
            <div className="chips">
              {s.map.fallbacks.map((f) => <span key={f} className="chip on-ok"><Icon name="check" size={14} /> {f}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="h2">Pełny plan <span className="muted h2-sub">kliknij krok, żeby zmienić status</span></h2>
        <div className="plan">
          {groups.map((g) => (
            <div key={g.p} className="plan-group card">
              <div className="card-head"><h3>{g.items[0].priority_label}</h3><span>{g.items.length}</span></div>
              <ul className="actions">
                {g.items.map((a) => <ActionItem key={a.id} a={a} onClick={() => cycle(a)} disabled={closed} showSafe />)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="continuity">
        <h2 className="h2">Ciągłość: czy kancelaria działa?</h2>
        {s.continuity.maintained ? (
          <div className="banner ok"><Icon name="check" size={22} /> {s.continuity.banner}</div>
        ) : (
          <div className="banner warn"><Icon name="alert" size={20} /> Nie mówimy „działamy”, dopóki ktoś nie potwierdzi tego, co krytyczne. Samo odhaczenie kroków nie wystarcza.</div>
        )}
        <div className="cont-grid">
          {s.continuity.items.map((c) => (
            <div key={c.id} className={`cont card st-${c.status}`}>
              <div className="card-head">
                <h3>{c.label} {c.top && <span className="pill lamp">najważniejsze</span>}</h3>
                <span className={`pill ${c.status === 'at_risk' ? 'bad' : c.status === 'paused' ? 'warn' : 'ok'}`}><span className="dot" />{CONT_LABEL[c.status]}</span>
              </div>
              <div className="card-pad stack">
                <p className="muted small">Plan B: {c.fallback}</p>
                {c.confirmations.map((x) => (
                  <label key={x.id} className="check">
                    <input type="checkbox" checked={x.done} disabled={closed} onChange={(e) => confirm(x.id, e.target.checked)} /> {x.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h2">Gotowe komunikaty</h2>
        <div className="msgs">
          {s.messages.map((m) => <Message key={m.id} channel={m.channel} text={m.text} />)}
        </div>
      </section>

      {closed && (
        <section className="fill card">
          <Mascot size={120} pose="dig" />
          <div className="stack">
            <span className="eyebrow">Wnioski</span>
            <h2>Zasypmy tunel, którym to przyszło.</h2>
            <p className="muted">Kret zaznaczył zabezpieczenia, które zamknęłyby drogę temu atakowi. Odhacz te, które już wprowadziliście, a kret przekopie mapę jeszcze raz.</p>
            {s.lessons.map((l) => (
              <label key={l.id} className="check">
                <input type="checkbox" checked={lessons.includes(l.id)} disabled={l.state === 'present'}
                  onChange={(e) => setLessons((ls) => (e.target.checked ? [...ls, l.id] : ls.filter((x) => x !== l.id)))} />
                <span><b>{l.label}</b> <span className="muted small">{l.state === 'present' ? '(już jest)' : `${l.effort_min} min · ${l.fix}`}</span></span>
              </label>
            ))}
            <div><button className="btn btn-lamp" disabled={!lessons.length} onClick={fill}>Zasyp i wpuść kreta ▸</button></div>
          </div>
        </section>
      )}

      <section>
        <h2 className="h2">Dziennik</h2>
        <ol className="timeline">
          {inc.events.map((e) => (
            <li key={e.id} className={`ev-${e.kind}`}>
              <span className="mono muted small">{time(e.created_at)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function ActionItem({ a, onClick, disabled, showSafe }: { a: Action; onClick: () => void; disabled?: boolean; showSafe?: boolean }) {
  return (
    <li className={`action st-${a.status}`}>
      <button onClick={onClick} disabled={disabled} aria-label={`${a.title}: ${STATUS_LABEL[a.status]}. Zmień status.`}>
        <span className="box">{a.status === 'done' ? '✓' : a.status === 'in_progress' ? '…' : ''}</span>
        <span className="a-body">
          <b>{a.title}</b>
          <span className="muted small">{a.detail}</span>
          <span className="row gap-sm wrap">
            <span className="src">{a.role_label}</span>
            {a.status !== 'todo' && <span className={`src ${a.status === 'done' ? 'fixed' : 'kret'}`}>{STATUS_LABEL[a.status]}</span>}
            {showSafe && a.safe_any_cause && <span className="src fixed">bezpieczne zawsze</span>}
          </span>
        </span>
      </button>
    </li>
  )
}

function Message({ channel, text }: { channel: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="msg card card-pad stack">
      <div className="row between"><b>{channel}</b>
        <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
          <Icon name="copy" size={14} /> {copied ? 'Skopiowane' : 'Kopiuj'}
        </button>
      </div>
      <p className="muted">{text}</p>
    </div>
  )
}
