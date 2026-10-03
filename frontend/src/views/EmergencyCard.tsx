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
        setPrinted(new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }))
      },
      (e: Error) => setError(e.message),
    )
  }, [])

  if (error) return <p className="bad">{error}</p>
  if (!card) return <p className="muted">Ładowanie karty…</p>

  return (
    <div className="ecard-page">
      <header className="page-head no-print">
        <div>
          <h1>Karta kreta do szuflady</h1>
          <p className="muted">
            Jedna kartka na wypadek, gdy padnie poczta, internet albo prąd. Wydrukuj ją teraz i połóż tam, gdzie każdy ją znajdzie.
          </p>
        </div>
        <button className="btn btn-lamp btn-lg" onClick={() => window.print()}>
          <Icon name="printer" size={18} /> Drukuj kartę
        </button>
      </header>

      <article className="ecard">
        <header className="ecard-head">
          <div className="row gap-sm">
            <BrandMark size={44} />
            <div>
              <b>Karta awaryjna CyberKreta</b>
              <small>{card.org}</small>
            </div>
          </div>
          <span className="mono small">wydrukowano {printed}</span>
        </header>

        <section>
          <h2>Pierwsze kroki, zanim wiesz, co się stało</h2>
          <ol className="ecard-steps">
            {card.first_steps.map((s) => (
              <li key={s.title}>
                <b>{s.title}</b>
                <span>{s.detail}</span>
                <em>{s.role}</em>
              </li>
            ))}
          </ol>
        </section>

        <div className="ecard-grid">
          <section>
            <h2>Kto co robi</h2>
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
            <h2>Kanały zastępcze</h2>
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
            <h2>Telefony do kontrahentów: tylko nimi potwierdzasz zmianę konta</h2>
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
          <h2>Zasady, które obowiązują zawsze</h2>
          <ul className="ecard-rules">
            {card.rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>

        <footer className="ecard-foot">Karta działa bez prądu i internetu. Wydrukuj nową po każdej zmianie w zespole albo u kontrahentów.</footer>
      </article>
    </div>
  )
}
