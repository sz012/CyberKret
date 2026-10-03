import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Contact, Duty, Org, OrgProfile, SafeguardState } from '../api/types'
import { Icon } from '../components/icons'
import { useOrg } from '../components/orgContext'

const DUTIES: { value: Duty; label: string }[] = [
  { value: 'boss', label: 'Szef, podejmuje decyzje' },
  { value: 'finance', label: 'Płatności i faktury' },
  { value: 'office', label: 'Biuro i klienci' },
  { value: 'it', label: 'Informatyk' },
  { value: 'other', label: 'Inna rola' },
]

const STATE_LABEL: Record<SafeguardState, string> = { present: 'jest', missing: 'brak', unknown: 'nie wiem' }

function toProfile(org: Org): OrgProfile {
  const owner = org.people.findIndex((p) => p.id === org.mailbox_owner)
  return {
    name: org.name,
    domain: org.domain,
    phone: org.phone ?? '',
    description: org.description ?? '',
    key_deadline: org.continuity[0]?.label ?? '',
    people: org.people.map((p) => ({ id: p.id, name: p.name, role: p.role, duty: p.duty ?? 'other' })),
    mailbox_owner_index: org.people.length ? Math.max(0, owner) : null,
    contacts: org.contacts.map((c) => ({ ...c })),
    fallbacks: org.fallbacks.map((f) => ({ label: f.label, note: f.note })),
  }
}

const EMPTY_CONTACT: Contact = { name: '', domain: '', phone: '', note: '' }

export default function Company() {
  const { reloadOrg } = useOrg()
  const [org, setOrg] = useState<Org | null>(null)
  const [form, setForm] = useState<OrgProfile | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    api.org().then((o) => {
      setOrg(o)
      setForm(toProfile(o))
    })
  }, [])

  if (!org || !form) return <p className="muted">Ładowanie firmy…</p>

  const update = (patch: Partial<OrgProfile>) => setForm({ ...form, ...patch })
  const setPerson = (i: number, patch: Partial<OrgProfile['people'][number]>) =>
    update({ people: form.people.map((p, k) => (k === i ? { ...p, ...patch } : p)) })
  const setContact = (i: number, patch: Partial<Contact>) =>
    update({ contacts: form.contacts.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
  const setFallback = (i: number, patch: Partial<OrgProfile['fallbacks'][number]>) =>
    update({ fallbacks: form.fallbacks.map((f, k) => (k === i ? { ...f, ...patch } : f)) })

  const removePerson = (i: number) => {
    const owner = form.mailbox_owner_index
    const people = form.people.filter((_, k) => k !== i)
    const next = owner === null || !people.length ? (people.length ? 0 : null) : owner > i ? owner - 1 : owner === i ? 0 : owner
    update({ people, mailbox_owner_index: next })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      const o = await api.saveProfile({
        ...form,
        people: form.people.filter((p) => p.name.trim()),
        contacts: form.contacts.filter((c) => c.name.trim()),
        fallbacks: form.fallbacks.filter((f) => f.label.trim()),
      })
      setOrg(o)
      setForm(toProfile(o))
      await reloadOrg()
      setStatus({ ok: true, text: 'Zapisano. Kret użyje tych danych przy kolejnym przejściu, w poczcie i w incydencie.' })
    } catch (x) {
      setStatus({ ok: false, text: (x as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const startOwn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm('Zacząć od własnej firmy? Dane demo (incydenty, maile i przejścia kreta) zostaną usunięte z tego komputera.')) return
    const o = await api.newOrg(newName.trim())
    setOrg(o)
    setForm(toProfile(o))
    setNewName('')
    await reloadOrg()
    setStatus({ ok: true, text: 'Firma utworzona. Uzupełnij ludzi i kontrahentów, potem odpowiedz na pytania o zabezpieczenia.' })
  }

  const setSafeguard = async (id: string, state: SafeguardState) => {
    await api.patchSafeguard(id, state)
    setOrg(await api.org())
  }

  const answered = org.safeguards.filter((s) => s.state !== 'unknown').length

  return (
    <div className="company-page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Ustawienia</span>
          <h1>Moja firma</h1>
          <p className="muted">Kret sprawdza to, co tu wpiszesz: ludzi, kontrahentów, domenę i zabezpieczenia. Wszystko zostaje na tym komputerze.</p>
        </div>
      </header>

      {org.demo && (
        <section className="card card-pad demo-note">
          <div>
            <b>Teraz oglądasz firmę demo: {org.name}.</b>
            <p className="muted">Silniki działają naprawdę, ale na zmyślonych danych. Zacznij od swojej firmy, a kret będzie sprawdzał Ciebie.</p>
          </div>
          <form className="row gap-sm wrap" onSubmit={startOwn}>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nazwa Twojej firmy" aria-label="Nazwa Twojej firmy" maxLength={80} />
            <button className="btn btn-lamp" disabled={!newName.trim()}>Zacznij od mojej firmy</button>
          </form>
        </section>
      )}

      {status && <p className={`company-status ${status.ok ? 'ok' : 'bad'}`} role="status">{status.text}</p>}

      <form className="company-form" onSubmit={save}>
        <section className="card">
          <div className="card-head"><h3>Firma</h3><span>podstawowe dane</span></div>
          <div className="card-pad form-grid">
            <label className="field">
              <span>Nazwa</span>
              <input className="input" required maxLength={80} value={form.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>Domena firmy</span>
              <input className="input" maxLength={253} value={form.domain} onChange={(e) => update({ domain: e.target.value })} placeholder="firma.pl" />
            </label>
            <label className="field">
              <span>Telefon firmy</span>
              <input className="input" maxLength={40} value={form.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="trafi do komunikatów dla klientów" />
            </label>
            <label className="field">
              <span>Czym się zajmujecie</span>
              <input className="input" maxLength={300} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="np. biuro rachunkowe, 6 osób" />
            </label>
            <label className="field wide">
              <span>Co musi się udać w najbliższych 24 godzinach, nawet gdy padnie poczta?</span>
              <input className="input" maxLength={120} value={form.key_deadline} onChange={(e) => update({ key_deadline: e.target.value })} placeholder="np. termin w sądzie, wypłaty, wysyłka zamówień" />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Ludzie</h3><span>kroki w incydencie trafiają do osób według funkcji</span></div>
          <div className="card-pad stack">
            {form.people.length === 0 && <p className="muted small">Dodaj przynajmniej siebie. Kret przypisze Ci kroki w incydencie i pokaże Cię na karcie awaryjnej.</p>}
            {form.people.map((p, i) => (
              <div key={i} className="edit-row people-row">
                <input className="input" required maxLength={80} value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} placeholder="Imię i nazwisko" aria-label="Imię i nazwisko" />
                <input className="input" maxLength={80} value={p.role} onChange={(e) => setPerson(i, { role: e.target.value })} placeholder="Stanowisko" aria-label="Stanowisko" />
                <select className="input" value={p.duty} onChange={(e) => setPerson(i, { duty: e.target.value as Duty })} aria-label="Funkcja">
                  {DUTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <label className="check small owner-check">
                  <input type="radio" name="owner" checked={form.mailbox_owner_index === i} onChange={() => update({ mailbox_owner_index: i })} />
                  skrzynka
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePerson(i)} aria-label={`Usuń ${p.name || 'osobę'}`}>Usuń</button>
              </div>
            ))}
            <div className="row gap-sm wrap">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ people: [...form.people, { name: '', role: '', duty: form.people.length ? 'other' : 'boss' }], mailbox_owner_index: form.mailbox_owner_index ?? 0 })}>
                Dodaj osobę
              </button>
              <span className="muted small">„Skrzynka” oznacza osobę, której pocztę czyta kret pocztowy.</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Kontrahenci</h3><span>kret porównuje z nimi nadawców maili</span></div>
          <div className="card-pad stack">
            {form.contacts.length === 0 && <p className="muted small">Wpisz firmy, od których dostajecie faktury. Mail z podobnej, ale innej domeny kret oznaczy jako podróbkę, a telefon trafi na kartę awaryjną.</p>}
            {form.contacts.map((c, i) => (
              <div key={i} className="edit-row contact-row">
                <input className="input" required maxLength={80} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} placeholder="Nazwa" aria-label="Nazwa kontrahenta" />
                <input className="input" maxLength={253} value={c.domain} onChange={(e) => setContact(i, { domain: e.target.value })} placeholder="domena, np. hurtownia.pl" aria-label="Domena kontrahenta" />
                <input className="input" maxLength={40} value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} placeholder="telefon z umowy" aria-label="Telefon kontrahenta" />
                <input className="input" maxLength={200} value={c.note} onChange={(e) => setContact(i, { note: e.target.value })} placeholder="notatka" aria-label="Notatka" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ contacts: form.contacts.filter((_, k) => k !== i) })} aria-label={`Usuń ${c.name || 'kontrahenta'}`}>Usuń</button>
              </div>
            ))}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ contacts: [...form.contacts, { ...EMPTY_CONTACT }] })}>Dodaj kontrahenta</button></div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Kanały zastępcze</h3><span>czym się kontaktujecie, gdy padnie poczta</span></div>
          <div className="card-pad stack">
            {form.fallbacks.map((f, i) => (
              <div key={i} className="edit-row fallback-row">
                <input className="input" required maxLength={60} value={f.label} onChange={(e) => setFallback(i, { label: e.target.value })} placeholder="np. telefon firmy" aria-label="Kanał" />
                <input className="input" maxLength={200} value={f.note} onChange={(e) => setFallback(i, { note: e.target.value })} placeholder="notatka" aria-label="Notatka" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ fallbacks: form.fallbacks.filter((_, k) => k !== i) })} aria-label={`Usuń ${f.label || 'kanał'}`}>Usuń</button>
              </div>
            ))}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ fallbacks: [...form.fallbacks, { label: '', note: '' }] })}>Dodaj kanał</button></div>
          </div>
        </section>

        <div className="save-bar">
          <button className="btn btn-lamp" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz zmiany'}</button>
          <span className="muted small">Zabezpieczenia poniżej zapisują się od razu.</span>
        </div>
      </form>

      <section className="card">
        <div className="card-head"><h3>Zabezpieczenia</h3><span>{answered} z {org.safeguards.length} z odpowiedzią</span></div>
        <div className="card-pad stack">
          <p className="muted small">Odpowiedz zgodnie z prawdą. „Nie wiem” też jest odpowiedzią: kret pokaże wtedy tunel jako możliwy. Domenę i ten komputer kret sprawdzi sam w Tunelach.</p>
          <ul className="sg-list">
            {org.safeguards.map((s) => (
              <li key={s.id} className="sg-item">
                <div>
                  <b>{s.label}</b>
                  {s.help && <p className="muted small">{s.help}</p>}
                </div>
                <div className="seg" role="group" aria-label={`Stan: ${s.label}`}>
                  {(['present', 'missing', 'unknown'] as SafeguardState[]).map((st) => (
                    <button key={st} type="button" className={s.state === st ? 'on' : ''} onClick={() => setSafeguard(s.id, st)}>{STATE_LABEL[st]}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div><Link className="btn btn-lamp btn-sm" to="/app/tunele?kop=1"><Icon name="router" size={16} /> Wpuść kreta do mojej firmy</Link></div>
        </div>
      </section>
    </div>
  )
}
