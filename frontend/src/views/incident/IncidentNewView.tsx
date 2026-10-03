import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import { Icon } from '../../components/Icon'
import { ErrorNote, Loading, PageHead, Panel, Pill } from '../../components/ui'
import { countLabel } from '../../lib/format'
import { useResource } from '../../lib/useResource'

function initialFacts(state: unknown): string[] {
  if (state && typeof state === 'object' && 'facts' in state && Array.isArray(state.facts)) {
    return state.facts.filter((fact): fact is string => typeof fact === 'string')
  }
  return []
}

export function IncidentNewView() {
  const location = useLocation()
  const navigate = useNavigate()
  const catalog = useResource(api.catalog, 'catalog')
  const [type, setType] = useState('payment_fraud')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [facts, setFacts] = useState<string[]>(() => initialFacts(location.state))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (catalog.loading && !catalog.data) return <Loading />
  if (catalog.error || !catalog.data) {
    return <ErrorNote message={catalog.error ?? 'Nie udało się wczytać pytań.'} onRetry={catalog.reload} />
  }

  const questions = catalog.data.questions.filter((question) => question.in_form)
  const missing = questions.filter((question) => !answers[question.id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (missing.length) return
    setBusy(true)
    setError(null)
    try {
      const incident = await api.createIncident(type, answers, facts)
      navigate(`/incydenty/${incident.id}`)
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <form className="page" onSubmit={submit}>
      <PageHead
        depth="5 m"
        title="Co się stało?"
        lead="Kilka prostych pytań. Jeśli czegoś nie wiesz, wybierz „nie wiem”. Plan zmieni się, gdy dowiesz się więcej."
      />

      <Panel title="Rodzaj zdarzenia">
        <div className="panel-body type-grid" role="radiogroup" aria-label="Rodzaj zdarzenia">
          {catalog.data.types.map((item) => (
            <label key={item.id} className={`type-card${!item.available ? ' is-disabled' : ''}${type === item.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="type"
                value={item.id}
                checked={type === item.id}
                disabled={!item.available}
                onChange={() => setType(item.id)}
              />
              <span className="type-card__title">{item.label}</span>
              <span className="type-card__text">{item.description}</span>
              {!item.available && <Pill tone="muted">w przygotowaniu</Pill>}
            </label>
          ))}
        </div>
      </Panel>

      {facts.length > 0 && (
        <Panel title="Fakty z analizy wiadomości" aside="trafią do obrazu sytuacji jako potwierdzone">
          <ul className="panel-body fact-chips">
            {facts.map((fact) => (
              <li key={fact}>
                <Icon name="check" size={15} />
                <span>{fact}</span>
                <button
                  type="button"
                  className="btn btn--quiet btn--tiny"
                  onClick={() => setFacts((previous) => previous.filter((item) => item !== fact))}
                  aria-label={`Usuń fakt: ${fact}`}
                >
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Pytania" aside={missing.length ? `brakuje ${missing.length}` : 'komplet'}>
        <div className="panel-body questions">
          {questions.map((question, index) => (
            <fieldset key={question.id} className="question">
              <legend>
                <span className="question__n">{index + 1}</span>
                {question.text}
              </legend>
              <p className="question__help">{question.help}</p>
              <div className="choice-row">
                {question.options.map((option) => (
                  <label key={option.value} className={`choice${answers[question.id] === option.value ? ' is-selected' : ''}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      checked={answers[question.id] === option.value}
                      onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option.value }))}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Panel>

      {error && <ErrorNote message={error} />}
      <div className="submit-bar">
        <span className="muted">
          {missing.length
            ? `Brakuje ${countLabel(missing.length, 'odpowiedzi', 'odpowiedzi', 'odpowiedzi')}.`
            : 'Gotowe. Plan powstanie od razu.'}
        </span>
        <button type="submit" className="btn btn--sos" disabled={busy || missing.length > 0}>
          <Icon name="siren" size={18} />
          {busy ? 'Układam plan…' : 'Uruchom plan'}
        </button>
      </div>
    </form>
  )
}
