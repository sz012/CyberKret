import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { EmergencyCard as Card } from '../api/types'
import { BrandMark } from '../components/BrandMark'
import { Icon } from '../components/icons'

export default function EmergencyCard() {
  const [card, setCard] = useState<Card | null>(null)
  const [printed, setPrinted] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.card().then(
      (value) => {
        setCard(value)
        setPrinted(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  if (error) return <p className="bad">{error}</p>
  if (!card) return <p className="muted">Loading the card…</p>

  return (
    <div className="ecard-page">
      <header className="page-head no-print">
        <div>
          <h1>The mole card for your drawer</h1>
          <p className="muted">
            One sheet for the day email, internet or power goes down. Print it now and keep it where everyone can find it.
          </p>
        </div>
        <button className="btn btn-lamp btn-lg" onClick={() => window.print()}>
          <Icon name="printer" size={18} /> Print the card
        </button>
      </header>

      <article className="ecard">
        <header className="ecard-head">
          <div className="row gap-sm">
            <BrandMark size={44} paper />
            <div>
              <b>cyberMole emergency card</b>
              <small>{card.org}</small>
            </div>
          </div>
          <span className="mono small">printed {printed}</span>
        </header>

        <section>
          <h2>First steps, before you know more</h2>
          <div className="ecard-types">
            {card.by_type.map((t) => (
              <div key={t.id}>
                <h3>{t.label}</h3>
                <ol className="ecard-steps">
                  {t.steps.map((s) => (
                    <li key={s.title}>
                      <b>{s.title}</b>
                      <em>{s.role}</em>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <div className="ecard-grid">
          <section>
            <h2>Who does what</h2>
            <ul className="ecard-list">
              {card.people.map((p) => (
                <li key={p.id}>
                  <b>{p.name}</b>
                  <span>{p.role}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Backup channels</h2>
            <ul className="ecard-list">
              {card.fallbacks.map((f) => (
                <li key={f.id}>
                  <b>{f.label}</b>
                  <span>{f.note}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {card.contacts.length > 0 && (
          <section>
            <h2>Vendor phone numbers: the only way to confirm a bank account change</h2>
            <table className="ecard-table">
              <tbody>
                {card.contacts.map((c) => (
                  <tr key={c.name}>
                    <td><b>{c.name}</b></td>
                    <td className="mono">{c.phone}</td>
                    <td>{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2>Rules that always apply</h2>
          <ul className="ecard-rules">
            {card.rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>

        <footer className="ecard-foot">This card works without power or internet. Print a new one after every change in the team or among your vendors.</footer>
      </article>
    </div>
  )
}
