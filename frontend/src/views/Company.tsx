import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Contact, Duty, Org, OrgProfile, SafeguardState } from '../api/types'
import { Icon } from '../components/icons'
import { useOrg } from '../components/orgContext'

const DUTIES: { value: Duty; label: string }[] = [
  { value: 'boss', label: 'Owner, makes decisions' },
  { value: 'finance', label: 'Payments and invoices' },
  { value: 'office', label: 'Office and clients' },
  { value: 'it', label: 'IT' },
  { value: 'other', label: 'Other role' },
]

const STATE_LABEL: Record<SafeguardState, string> = { present: 'yes', missing: 'no', unknown: "don't know" }

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

  if (!org || !form) return <p className="muted">Loading the company…</p>

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
      setStatus({ ok: true, text: 'Saved. The mole will use this data in its next run, in email checks and in incidents.' })
    } catch (x) {
      setStatus({ ok: false, text: (x as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const startOwn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirm('Start with your own company? Demo data (incidents, emails and mole runs) will be removed from this computer.')) return
    const o = await api.newOrg(newName.trim())
    setOrg(o)
    setForm(toProfile(o))
    setNewName('')
    await reloadOrg()
    setStatus({ ok: true, text: 'Company created. Add people and vendors, then answer the questions about safeguards.' })
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
          <span className="eyebrow">Settings</span>
          <h1>My company</h1>
          <p className="muted">The mole checks what you enter here: people, vendors, the domain and safeguards. Everything stays on this computer.</p>
        </div>
      </header>

      {org.demo && (
        <section className="card card-pad demo-note">
          <div>
            <b>You are looking at a demo company: {org.name}.</b>
            <p className="muted">The engines really work, but on made-up data. Start with your own company and the mole will check you.</p>
          </div>
          <form className="row gap-sm wrap" onSubmit={startOwn}>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Your company name" aria-label="Your company name" maxLength={80} />
            <button className="btn btn-lamp" disabled={!newName.trim()}>Start with my company</button>
          </form>
        </section>
      )}

      {status && <p className={`company-status ${status.ok ? 'ok' : 'bad'}`} role="status">{status.text}</p>}

      <form className="company-form" onSubmit={save}>
        <section className="card">
          <div className="card-head"><h3>Company</h3><span>basic details</span></div>
          <div className="card-pad form-grid">
            <label className="field">
              <span>Name</span>
              <input className="input" required maxLength={80} value={form.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>Company domain</span>
              <input className="input" maxLength={253} value={form.domain} onChange={(e) => update({ domain: e.target.value })} placeholder="company.com" />
            </label>
            <label className="field">
              <span>Company phone</span>
              <input className="input" maxLength={40} value={form.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="goes into messages for clients" />
            </label>
            <label className="field">
              <span>What you do</span>
              <input className="input" maxLength={300} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="e.g. accounting office, 6 people" />
            </label>
            <label className="field wide">
              <span>What must get done in the next 24 hours, even if email goes down?</span>
              <input className="input" maxLength={120} value={form.key_deadline} onChange={(e) => update({ key_deadline: e.target.value })} placeholder="e.g. a court deadline, payroll, shipping orders" />
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>People</h3><span>incident steps go to people by their role</span></div>
          <div className="card-pad stack">
            {form.people.length === 0 && <p className="muted small">Add at least yourself. The mole will assign you incident steps and put you on the emergency card.</p>}
            {form.people.map((p, i) => (
              <div key={i} className="edit-row people-row">
                <input className="input" required maxLength={80} value={p.name} onChange={(e) => setPerson(i, { name: e.target.value })} placeholder="Full name" aria-label="Full name" />
                <input className="input" maxLength={80} value={p.role} onChange={(e) => setPerson(i, { role: e.target.value })} placeholder="Job title" aria-label="Job title" />
                <select className="input" value={p.duty} onChange={(e) => setPerson(i, { duty: e.target.value as Duty })} aria-label="Role">
                  {DUTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <label className="check small owner-check">
                  <input type="radio" name="owner" checked={form.mailbox_owner_index === i} onChange={() => update({ mailbox_owner_index: i })} />
                  mailbox
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePerson(i)} aria-label={`Remove ${p.name || 'person'}`}>Remove</button>
              </div>
            ))}
            <div className="row gap-sm wrap">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ people: [...form.people, { name: '', role: '', duty: form.people.length ? 'other' : 'boss' }], mailbox_owner_index: form.mailbox_owner_index ?? 0 })}>
                Add a person
              </button>
              <span className="muted small">"Mailbox" marks the person whose email the mail mole reads.</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Vendors</h3><span>the mole compares email senders with them</span></div>
          <div className="card-pad stack">
            {form.contacts.length === 0 && <p className="muted small">Add the companies that send you invoices. The mole flags email from a similar but different domain as a fake, and the phone number goes on the emergency card.</p>}
            {form.contacts.map((c, i) => (
              <div key={i} className="edit-row contact-row">
                <input className="input" required maxLength={80} value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} placeholder="Name" aria-label="Vendor name" />
                <input className="input" maxLength={253} value={c.domain} onChange={(e) => setContact(i, { domain: e.target.value })} placeholder="domain, e.g. supplier.com" aria-label="Vendor domain" />
                <input className="input" maxLength={40} value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} placeholder="phone from the contract" aria-label="Vendor phone" />
                <input className="input" maxLength={200} value={c.note} onChange={(e) => setContact(i, { note: e.target.value })} placeholder="note" aria-label="Note" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ contacts: form.contacts.filter((_, k) => k !== i) })} aria-label={`Remove ${c.name || 'vendor'}`}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ contacts: [...form.contacts, { ...EMPTY_CONTACT }] })}>Add a vendor</button></div>
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h3>Backup channels</h3><span>how you reach each other when email is down</span></div>
          <div className="card-pad stack">
            {form.fallbacks.map((f, i) => (
              <div key={i} className="edit-row fallback-row">
                <input className="input" required maxLength={60} value={f.label} onChange={(e) => setFallback(i, { label: e.target.value })} placeholder="e.g. company phone" aria-label="Channel" />
                <input className="input" maxLength={200} value={f.note} onChange={(e) => setFallback(i, { note: e.target.value })} placeholder="note" aria-label="Note" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ fallbacks: form.fallbacks.filter((_, k) => k !== i) })} aria-label={`Remove ${f.label || 'channel'}`}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ fallbacks: [...form.fallbacks, { label: '', note: '' }] })}>Add a channel</button></div>
          </div>
        </section>

        <div className="save-bar">
          <button className="btn btn-lamp" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          <span className="muted small">Safeguards below are saved right away.</span>
        </div>
      </form>

      <section className="card">
        <div className="card-head"><h3>Safeguards</h3><span>{answered} of {org.safeguards.length} answered</span></div>
        <div className="card-pad stack">
          <p className="muted small">Answer honestly. "Don't know" is a valid answer too: the mole then shows the tunnel as possible. The mole checks the domain and this computer by itself in Tunnels.</p>
          <ul className="sg-list">
            {org.safeguards.map((s) => (
              <li key={s.id} className="sg-item">
                <div>
                  <b>{s.label}</b>
                  {s.help && <p className="muted small">{s.help}</p>}
                </div>
                <div className="seg" role="group" aria-label={`Status: ${s.label}`}>
                  {(['present', 'missing', 'unknown'] as SafeguardState[]).map((st) => (
                    <button key={st} type="button" className={s.state === st ? 'on' : ''} onClick={() => setSafeguard(s.id, st)}>{STATE_LABEL[st]}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div><Link className="btn btn-lamp btn-sm" to="/app/tunnels?dig=1"><Icon name="router" size={16} /> Send the mole into my company</Link></div>
        </div>
      </section>
    </div>
  )
}
