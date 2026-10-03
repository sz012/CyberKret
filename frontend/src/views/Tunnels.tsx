import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import type { DomainResult, KretRun, KretStory, LocalCheck, Org, SafeguardState } from '../api/types'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import PasswordCheckCard from '../components/PasswordCheckCard'
import TunnelMap, { type DigEvent } from '../components/TunnelMap'
import { ago, plural } from '../util'

const STATE_LABEL: Record<SafeguardState, string> = { present: 'jest', missing: 'brak', unknown: 'nie wiem' }

export default function Tunnels() {
  const [params, setParams] = useSearchParams()
  const [org, setOrg] = useState<Org | null>(null)
  const [run, setRun] = useState<KretRun | null>(null)
  const [prev, setPrev] = useState<KretRun | null>(null)
  const [token, setToken] = useState(0)
  const [digging, setDigging] = useState(false)
  const [fast, setFast] = useState(false)
  const [log, setLog] = useState<DigEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [story, setStory] = useState<KretStory | null>(null)
  const [storyLoading, setStoryLoading] = useState(false)
  const logRef = useRef<HTMLOListElement>(null)
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    Promise.all([api.org(), api.runs()]).then(([o, runs]) => {
      setOrg(o)
      if (runs[0]) {
        setRun(runs[0])
        setPrev(runs[1] ?? null)
        loadStory(runs[0].id)
      }
      if (params.get('kop')) {
        setParams({}, { replace: true })
        dig(params.get('label') ?? undefined, runs[0] ?? null)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const loadStory = (id: number) => {
    setStory(null)
    setStoryLoading(true)
    api.story(id).then(setStory).finally(() => setStoryLoading(false))
  }

  const dig = async (label?: string, before: KretRun | null = run) => {
    const o = await api.org()
    setOrg(o)
    const r = await api.runKret(label)
    setPrev(before)
    setRun(r)
    setSelected(null)
    setStory(null)
    setLog([])
    setDigging(true)
    setToken((t) => t + 1)
  }

  const onEvent = (e: DigEvent) => {
    setLog((l) => [...l, e])
    if (e.kind === 'done') {
      setDigging(false)
      setSelected(run?.tunnels[0]?.id ?? null)
      if (run) loadStory(run.id)
    }
  }

  const setSg = async (id: string, state: SafeguardState) => {
    await api.patchSafeguard(id, state)
    setOrg(await api.org())
  }

  const fix = async (sid: string) => {
    await api.applySafeguards([sid])
    await dig('po zasypaniu')
  }

  if (!org) return <p className="muted">Ładowanie mapy…</p>

  const sel = run?.tunnels.find((t) => t.id === selected) ?? null
  const chamberLabel = Object.fromEntries(org.chambers.map((c) => [c.id, c.label]))

  return (
    <div className="tunnels-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Funkcja 1 · Tunele</span>
          <h1>{digging ? 'Kret ryje w kablach pod podłogą…' : run ? run.summary.split('.')[0] + '.' : 'Wpuść kreta pod podłogę kancelarii.'}</h1>
          <p className="muted">
            Każdy kabel to jedna rzecz, którą kret sprawdza. Czerwona linia to tunel: droga, którą prawdziwy atakujący doszedłby z internetu do czegoś cennego.
          </p>
        </div>
        <div className="row gap">
          <label className="check small muted"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> szybko</label>
          <button className="btn btn-lamp btn-lg" disabled={digging} onClick={() => dig()}>
            {digging ? 'Kret ryje…' : run ? 'Wpuść kreta ponownie ▸' : 'Wpuść kreta ▸'}
          </button>
        </div>
      </header>

      {prev && run && !digging && prev.tunnels.length !== run.tunnels.length && (
        <div className={`compare card ${run.tunnels.length < prev.tunnels.length ? 'better' : 'worse'}`}>
          <Mascot size={70} pose={run.tunnels.length < prev.tunnels.length ? 'happy' : 'alarm'} />
          <div>
            <b>Przed: {prev.tunnels.length} {plural(prev.tunnels.length, 'tunel', 'tunele', 'tuneli')} → teraz: {run.tunnels.length}.</b>
            <p className="muted">
              {run.tunnels.length < prev.tunnels.length
                ? `Zasypane: ${prev.tunnels.filter((t) => !run.tunnels.some((x) => x.id === t.id)).map((t) => t.target_label.toLowerCase()).join(', ')}.`
                : 'Pojawiły się nowe tunele od ostatniego przejścia.'}
            </p>
          </div>
        </div>
      )}

      <div className="tunnels-grid">
        <div className="map-wrap card">
          <TunnelMap org={org} run={run} digToken={token} fast={fast} onEvent={onEvent} selected={selected} onSelect={setSelected} />
          <div className="legend">
            <span><i className="lg ok" /> w porządku</span>
            <span><i className="lg warn" /> do sprawdzenia</span>
            <span><i className="lg bad" /> otwarte</span>
            <span><i className="lg tunnel" /> tunel atakującego</span>
          </div>
        </div>

        <aside className="side">
          {(digging || (log.length > 0 && !story)) && (
            <div className="card">
              <div className="card-head"><h3>Relacja z kabli</h3><span className="pill lamp"><span className="dot" />{digging ? 'na żywo' : 'koniec'}</span></div>
              <ol className="digl" ref={logRef} aria-live="polite">
                {log.map((e, i) => (
                  <li key={i} className={`${e.kind} ${e.level ?? ''}`}>
                    <span className="mark">{e.kind === 'result' ? (e.level === 'ok' ? '✓' : e.level === 'bad' ? '✕' : '!') : e.kind === 'tunnel' ? '→' : '›'}</span>
                    {e.text}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!digging && run && (
            <div className="card story">
              <div className="card-head">
                <h3>Kret opowiada</h3>
                <span className={`src ${story?.llm.model ? 'model' : ''}`}>
                  {storyLoading ? 'model myśli…' : story?.llm.model ? `${story.llm.model} · ${((story.llm.ms ?? 0) / 1000).toFixed(1)} s` : 'szablon'}
                </span>
              </div>
              <div className="card-pad">
                {storyLoading && <p className="muted thinking">Kret zbiera myśli na tym komputerze…</p>}
                {story && (
                  <>
                    <p className="story-head">{story.headline}</p>
                    <p className="muted">{story.story}</p>
                    {story.first_step && <p className="story-next">{story.first_step}</p>}
                  </>
                )}
              </div>
            </div>
          )}

          {!digging && run && run.moves.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>Zasyp najpierw</h3><span>{run.moves.length} ruchy zamykają {run.tunnels.length - run.counts.after_moves} z {run.tunnels.length}</span></div>
              <ol className="moves">
                {run.moves.map((m, i) => (
                  <li key={m.safeguard}>
                    <span className="n">{i + 1}</span>
                    <div>
                      <h4>{m.label}</h4>
                      <p className="muted">{m.fix}</p>
                      <div className="row gap-sm wrap">
                        <span className="pill lamp">{m.effort_min} min</span>
                        <span className="pill muted">{m.cost}</span>
                        <span className="pill bad">zamyka {m.closes.length} {plural(m.closes.length, 'tunel', 'tunele', 'tuneli')}</span>
                        <button className="btn btn-ok btn-sm" onClick={() => fix(m.safeguard)}>Zrobione, zasyp</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!digging && run && run.tunnels.length === 0 && (
            <div className="card card-pad center">
              <Mascot size={150} pose="happy" />
              <h3>Wszystkie tunele zasypane.</h3>
              <p className="muted">Kret nie znalazł drogi z internetu do akt, pieniędzy ani do zatrzymania pracy.</p>
            </div>
          )}
        </aside>
      </div>

      {!digging && run && run.tunnels.length > 0 && (
        <section className="tunnel-list">
          <h2>Tunele po kolei</h2>
          <div className="tl-grid">
            {run.tunnels.map((t) => (
              <button key={t.id} className={`tl card ${t.id === selected ? 'sel' : ''} ${t.state}`} onClick={() => setSelected(t.id)}>
                <div className="tl-head">
                  <span className="pill bad"><span className="dot" />tunel {t.n}</span>
                  <b>do: {t.target_label}</b>
                </div>
                <p className="muted small">{t.harm}</p>
                <ol>
                  {t.steps.map((s) => (
                    <li key={s.technique}><b>{s.name}</b> <span className="muted">({chamberLabel[s.chamber]})</span></li>
                  ))}
                </ol>
              </button>
            ))}
          </div>
          {sel && (
            <div className="narration card card-pad">
              <Mascot size={90} pose="check" />
              <div>
                <span className="eyebrow">Tak wszedłby atakujący · tunel {sel.n}</span>
                {sel.steps.map((s, i) => (
                  <p key={s.technique}><b>{i + 1}.</b> {s.narration}</p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {run && !digging && (
        <section className="findings">
          <h2>Co sprawdził kret i skąd to wie</h2>
          <p className="muted">Każda informacja ma źródło. Zmień stan, jeśli coś się nie zgadza, i wpuść kreta ponownie.</p>
          <div className="find-grid">
            {run.chambers.map((c) => (
              <div key={c.chamber} className={`find card st-${c.status}`}>
                <div className="card-head"><h3>{c.label}</h3><span className={`pill ${c.status}`}><span className="dot" />{c.status === 'ok' ? 'OK' : c.status === 'bad' ? 'otwarte' : 'sprawdź'}</span></div>
                <ul>
                  {c.items.map((it) => {
                    const sg = org.safeguards.find((s) => s.id === it.safeguard)!
                    return (
                      <li key={it.safeguard}>
                        <div className="find-line">
                          <span className={`mark ${it.level}`}>{it.level === 'ok' ? '✓' : it.level === 'bad' ? '✕' : '!'}</span>
                          <div>
                            <b>{it.label}</b>
                            <p className="muted small">{it.evidence}</p>
                          </div>
                        </div>
                        <div className="row gap-sm wrap">
                          <span className={`src ${it.source}`}>{it.source_label}</span>
                          <div className="seg" role="group" aria-label={`Stan: ${it.label}`}>
                            {(['present', 'missing', 'unknown'] as SafeguardState[]).map((s) => (
                              <button key={s} className={sg.state === s ? 'on' : ''} onClick={() => setSg(it.safeguard, s)}>{STATE_LABEL[s]}</button>
                            ))}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="extra-checks">
        <DomainCheckCard defaultDomain={org.domain} onApplied={async () => setOrg(await api.org())} />
        <LocalCheckCard onApplied={async () => setOrg(await api.org())} />
        <PasswordCheckCard name={org.name} domain={org.domain} />
      </section>
      {run && <p className="muted small mono">Ostatnie przejście kreta: {ago(run.created_at)}{run.label ? ` · ${run.label}` : ''}</p>}
    </div>
  )
}

function DomainCheckCard({ defaultDomain, onApplied }: { defaultDomain: string; onApplied: () => void }) {
  const [domain, setDomain] = useState(defaultDomain)
  const [consent, setConsent] = useState(false)
  const [res, setRes] = useState<DomainResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      setRes(await api.domainCheck(domain))
      onApplied()
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card">
      <div className="card-head"><h3>Sprawdź domenę z zewnątrz</h3><span className="src kret">tylko odczyt</span></div>
      <form className="card-pad stack" onSubmit={go}>
        <p className="muted small">Kret czyta publiczne rekordy DNS i raz otwiera stronę główną. Żadnych portów, logowania ani ścieżek admina.</p>
        <div className="row gap-sm">
          <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domena" />
          <button className="btn btn-lamp btn-sm" disabled={!consent || busy}>{busy ? 'Sprawdzam…' : 'Sprawdź'}</button>
        </div>
        <label className="check small"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> To nasza domena, mam prawo ją sprawdzić.</label>
        {err && <p className="bad small">{err}</p>}
        {res && (
          <ul className="mini-findings">
            {res.demo && <li className="muted small">Dane demonstracyjne: domena .example nie istnieje w internecie.</li>}
            {res.findings.map((f) => (
              <li key={f.key}><span className={`mark ${f.level}`}>{f.level === 'ok' ? '✓' : f.level === 'bad' ? '✕' : '!'}</span><b>{f.title}</b> <span className="muted">{f.detail}</span></li>
            ))}
          </ul>
        )}
      </form>
    </div>
  )
}

function LocalCheckCard({ onApplied }: { onApplied: () => void }) {
  const [res, setRes] = useState<LocalCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      setRes(await api.localCheck())
      onApplied()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card">
      <div className="card-head"><h3>Sprawdź ten komputer</h3><span className="src kret">tylko odczyt</span></div>
      <div className="card-pad stack">
        <p className="muted small">Kret pyta system o zaporę, szyfrowanie dysku i aktualizacje. Niczego nie zmienia.</p>
        <button className="btn btn-ghost btn-sm" onClick={go} disabled={busy}><Icon name="laptop" size={16} /> {busy ? 'Sprawdzam…' : 'Sprawdź ten komputer'}</button>
        {res && (
          <ul className="mini-findings">
            <li className="muted small">{res.system}{res.hostname ? ` · ${res.hostname}` : ''}{res.note ? ` · ${res.note}` : ''}</li>
            {res.checks.map((c) => (
              <li key={c.id}>
                <span className={`mark ${c.level === 'unknown' ? 'warn' : c.level}`}>{c.level === 'ok' ? '✓' : c.level === 'bad' ? '✕' : '?'}</span>
                <b>{c.label}:</b> <span className={c.level === 'bad' ? 'bad' : 'muted'}>{c.text}</span>
                {c.fix && <div className="muted small">Jak naprawić: {c.fix}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
