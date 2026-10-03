import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Analysis, Inbox, MailMessage, MailRow } from '../api/types'
import { Icon } from '../components/icons'
import Mascot from '../components/Mascot'
import { useHealth } from '../components/useHealth'
import { plural, time } from '../util'

const SCAN_STEPS = [
  'Sprawdzam nadawcę i porównuję z kontrahentami',
  'Czytam nagłówki SPF, DKIM, DMARC',
  'Patrzę, dokąd naprawdę prowadzą linki',
  'Otwieram załączniki u siebie w norze, jako tekst',
  'Model lokalny czyta treść i tłumaczy',
]

function highlight(text: string, quotes: string[]) {
  const qs = quotes.filter((q) => q && text.includes(q)).sort((a, b) => b.length - a.length)
  if (!qs.length) return [text]
  const marks: [number, number][] = []
  for (const q of qs) {
    let i = text.indexOf(q)
    while (i >= 0) {
      if (!marks.some(([a, b]) => i < b && i + q.length > a)) marks.push([i, i + q.length])
      i = text.indexOf(q, i + q.length)
    }
  }
  marks.sort((a, b) => a[0] - b[0])
  const out: (string | React.ReactElement)[] = []
  let pos = 0
  marks.forEach(([a, b], k) => {
    out.push(text.slice(pos, a))
    out.push(<mark key={k} className="flag">{text.slice(a, b)}</mark>)
    pos = b
  })
  out.push(text.slice(pos))
  return out
}

export default function Mail() {
  const [rows, setRows] = useState<MailRow[]>([])
  const [box, setBox] = useState<Omit<Inbox, 'messages'> | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [msg, setMsg] = useState<MailMessage | null>(null)
  const [explaining, setExplaining] = useState<string | null>(null)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const [noMore, setNoMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const health = useHealth()
  const modelOn = !!health?.llm.available
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const nav = useNavigate()

  const say = (ok: boolean, text: string) => {
    setToast({ ok, text })
    setTimeout(() => setToast(null), 6000)
  }

  const refresh = async () => {
    const { messages, ...meta } = await api.inbox()
    setRows(messages)
    setBox(meta)
    return messages
  }

  const rulesScan = async (id: string) => {
    const a = await api.scanMail(id)
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, scan: { verdict: a.verdict, label: a.label, level: a.level } } : r)))
    setMsg((m) => (m && m.id === id ? { ...m, analysis: a } : m))
    return a
  }

  const explain = (id: string) => {
    queue.current = queue.current.then(async () => {
      setExplaining(id)
      try {
        const a = await api.explainMail(id)
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, scan: { verdict: a.verdict, label: a.label, level: a.level } } : r)))
        setMsg((m) => (m && m.id === id ? { ...m, analysis: a } : m))
      } finally {
        setExplaining(null)
      }
    })
    return queue.current
  }

  const open = async (id: string) => {
    setOpenId(id)
    const m = await api.mail(id)
    setMsg(m)
    const a = m.analysis ?? (await rulesScan(id))
    if (modelOn && !a.llm.model && a.llm.error !== 'brak lokalnego modelu') explain(id)
  }

  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    refresh().then(async (r) => {
      for (const x of r.filter((x) => !x.scan)) await rulesScan(x.id)
      if (r[0]) open(r[0].id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deliver = async () => {
    try {
      const { id } = await api.deliverNext()
      const r = await refresh()
      const m = r.find((x) => x.id === id)
      say(true, `Nowy mail: ${m?.from_name ?? ''}, „${m?.subject ?? ''}”. Kret już czyta.`)
      await open(id)
    } catch {
      setNoMore(true)
    }
  }

  const sync = async () => {
    setSyncing(true)
    try {
      const res = await api.syncMail()
      const r = await refresh()
      for (const x of r.filter((x) => !x.scan)) await rulesScan(x.id)
      say(true, res.new ? `Pobrano ${res.new} ${plural(res.new, 'nowy mail', 'nowe maile', 'nowych maili')} z ostatnich ${box?.imap.days ?? 14} dni.` : 'Brak nowych maili.')
    } catch (x) {
      say(false, (x as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const upload = async (f: File) => {
    const { id } = await api.uploadEml(await f.text())
    await refresh()
    await open(id)
  }

  const report = async () => {
    if (!msg) return
    const inc = await api.createIncident('fake_invoice', msg.id)
    nav(`/app/incydent/${inc.id}`)
  }

  const a = msg?.analysis ?? null
  const isExplaining = explaining !== null && explaining === msg?.id

  return (
    <div className="mail-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Funkcja 2 · Kret pocztowy</span>
          <h1>Kret czyta pocztę, zanim otworzy ją człowiek.</h1>
          <p className="muted">Reguły dają werdykt od razu. Model na tym komputerze tłumaczy go po ludzku. Załączniki kret otwiera u siebie, jako tekst, nigdy na komputerze pracownika.</p>
        </div>
        <div className="row gap-sm wrap">
          <label className="btn btn-ghost btn-sm">
            <Icon name="upload" size={16} /> Wczytaj .eml
            <input type="file" accept=".eml,message/rfc822" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {box?.imap.configured && (
            <button className="btn btn-lamp" onClick={sync} disabled={syncing}>{syncing ? 'Pobieram…' : 'Pobierz nowe maile'}</button>
          )}
          {box?.demo && !box.imap.configured && (
            <button className="btn btn-lamp" onClick={deliver} disabled={noMore}>{noMore ? 'Brak nowych maili' : 'Przyślij nowy mail (demo)'}</button>
          )}
        </div>
      </header>

      {box && !box.imap.configured && !box.demo && (
        <p className="muted small">Skrzynka nie jest podłączona. Wpisz IMAP_USER i IMAP_PASSWORD do pliku .env.local i uruchom backend ponownie. Instrukcja dla Gmaila jest w README.</p>
      )}

      {toast && <div className={`toast ${toast.ok ? '' : 'toast-bad'}`} role="status"><Icon name={toast.ok ? 'mail' : 'alert'} size={18} /> {toast.text}</div>}

      <div className="mailbox card">
        <div className="mb-list">
          <div className="mb-owner">
            <b>Skrzynka odbiorcza</b>
            <span className="muted small">
              {box?.imap.configured ? `${box.imap.user} · tylko odczyt` : box?.owner ? `${box.owner}${box.owner_role ? ` · ${box.owner_role.toLowerCase()}` : ''}` : 'maile wgrane ręcznie'}
            </span>
          </div>
          {rows.length === 0 && <p className="muted small card-pad">Pusto. {box?.imap.configured ? 'Kliknij „Pobierz nowe maile”.' : 'Wczytaj plik .eml albo podłącz skrzynkę.'}</p>}
          <ul>
            {rows.map((r) => (
              <li key={r.id}>
                <button className={`mb-row ${openId === r.id ? 'on' : ''} ${r.scan?.level ?? ''}`} onClick={() => open(r.id)}>
                  <div className="mb-row-top">
                    <b>{r.from_name}</b>
                    <span className="muted small">{r.received_at ? time(r.received_at) : ''}</span>
                  </div>
                  <div className="mb-subj">{r.subject}</div>
                  <div className="row gap-sm">
                    {r.scan ? (
                      <span className={`pill ${r.scan.level}`}><span className="dot" />{r.scan.label}</span>
                    ) : (
                      <span className="pill lamp"><span className="dot" />kret czyta…</span>
                    )}
                    {r.attachments.length > 0 && <Icon name="paperclip" size={14} className="muted" />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-read">
          {!msg && rows.length > 0 && <p className="muted card-pad">Wybierz wiadomość.</p>}
          {msg && (
            <>
              <div className="mb-meta">
                <h2>{msg.subject}</h2>
                <div><span className="muted">Od:</span> {msg.from_name} &lt;<span className={a?.indicators.some((i) => i.type === 'lookalike_sender') ? 'flag' : ''}>{msg.from_addr}</span>&gt;</div>
                {msg.reply_to && <div><span className="muted">Odpowiedź do:</span> <span className={a?.indicators.some((i) => i.type === 'reply_to_mismatch') ? 'flag' : ''}>{msg.reply_to}</span></div>}
                <div><span className="muted">Do:</span> {msg.to.join(', ')}</div>
              </div>

              {isExplaining && (
                <div className="scan-box">
                  <Mascot size={110} pose="check" />
                  <ol>
                    {SCAN_STEPS.map((s, i) => (
                      <li key={s} className={i < SCAN_STEPS.length - 1 ? 'done' : 'now'}>{i < SCAN_STEPS.length - 1 ? '✓' : '›'} {s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {a && <Verdict a={a} explaining={isExplaining} onReport={report} />}

              <div className="mb-body">
                {highlight(msg.text, a?.indicators.map((i) => i.quote ?? '') ?? []).map((x, i) => <span key={i}>{x}</span>)}
              </div>
              {msg.attachments.length > 0 && (
                <div className="mb-atts">
                  {msg.attachments.map((at) => {
                    const bad = a?.indicators.some((i) => i.quote === at.filename || i.type === 'credential_form')
                    return (
                      <span key={at.filename} className={`att ${bad ? 'bad' : ''}`}>
                        <Icon name="paperclip" size={15} /> {at.filename} <span className="muted">({Math.ceil(at.size / 1024)} KB)</span>
                        {bad && <span className="att-note">kret otworzył w norze: to strona z formularzem hasła</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AskKret />
    </div>
  )
}

function llmNote(a: Analysis, explaining: boolean): string {
  if (a.llm.model) return `wyjaśnienie: ${a.llm.model}, lokalnie, ${((a.llm.ms ?? 0) / 1000).toFixed(1)} s`
  if (explaining) return 'werdykt z reguł · model lokalny pisze wyjaśnienie'
  if (a.llm.error === 'brak lokalnego modelu') return 'tryb bez modelu: reguły i szablony'
  if (a.llm.error === 'nie pytano modelu') return 'werdykt z reguł'
  return 'model nie odpowiedział, wyjaśnienie z szablonu'
}

function Verdict({ a, explaining, onReport }: { a: Analysis; explaining: boolean; onReport: () => void }) {
  const signals = a.indicators.filter((i) => i.severity !== 'info')
  const info = a.indicators.filter((i) => i.severity === 'info')
  return (
    <div className={`verdict v-${a.level}`}>
      <div className="verdict-top">
        <Mascot size={92} pose={a.level === 'ok' ? 'happy' : 'alarm'} />
        <div>
          <span className={`pill ${a.level}`}><span className="dot" />{a.label}</span>
          <h3>{a.level === 'bad' ? `Stop. Kret znalazł ${signals.length} ${plural(signals.length, 'sygnał', 'sygnały', 'sygnałów')} oszustwa.` : a.level === 'warn' ? 'Uwaga, coś tu nie gra.' : 'Wygląda w porządku.'}</h3>
          <p>{a.summary}</p>
          {a.what_to_do && <p className="todo"><b>Co zrobić:</b> {a.what_to_do}</p>}
        </div>
      </div>
      {signals.length > 0 && (
        <ol className="signals">
          {signals.map((s, i) => (
            <li key={i}>
              <b>{s.title}.</b> <span className="muted">{s.detail}</span>
              <span className={`src ${s.source === 'model' ? 'model' : 'kret'}`}>{s.source === 'model' ? 'zauważył model' : 'sprawdził kret'}</span>
            </li>
          ))}
        </ol>
      )}
      {info.map((s, i) => <p key={i} className="muted small info-note">ⓘ {s.title}: {s.detail}</p>)}
      <div className="verdict-foot">
        <span className="muted small mono">{llmNote(a, explaining)} · nic nie wysłano na zewnątrz</span>
        {a.level !== 'ok' && <button className="btn btn-bad btn-sm" onClick={onReport}><Icon name="alert" size={15} /> Zgłoś incydent</button>}
      </div>
    </div>
  )
}

function AskKret() {
  const [text, setText] = useState('')
  const [res, setRes] = useState<Analysis | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      setRes(await api.analyzeText(text))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="ask card">
      <div className="card-head"><h3>Zapytaj kreta</h3><span>wklej SMS, link albo treść maila</span></div>
      <div className="card-pad ask-grid">
        <div className="stack">
          <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Np. „Twoja paczka czeka na dopłatę 1,99 zł: http://…”" />
          <button className="btn btn-lamp btn-sm" disabled={busy || text.trim().length < 3} onClick={go}>{busy ? 'Kret czyta…' : 'Czy to oszustwo?'}</button>
        </div>
        <div>
          {res ? (
            <div className={`ask-res v-${res.level}`}>
              <span className={`pill ${res.level}`}><span className="dot" />{res.label}</span>
              <p>{res.summary}</p>
              {res.what_to_do && <p><b>Co zrobić:</b> {res.what_to_do}</p>}
              <p className="muted small mono">{llmNote(res, false)}</p>
            </div>
          ) : (
            <p className="muted small">{busy ? 'Reguły już sprawdziły tekst, model lokalny pisze wyjaśnienie…' : 'Tekst zostaje na tym komputerze. Z modelem lokalnym odpowiedź zajmuje kilka do kilkunastu sekund.'}</p>
          )}
        </div>
      </div>
    </section>
  )
}
