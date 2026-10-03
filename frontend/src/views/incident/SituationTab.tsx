import type { ActionStatus, Incident, Organization, Priority } from '../../api/types'
import { Icon } from '../../components/Icon'
import { Panel, Pill } from '../../components/ui'
import { PRIORITY_LABELS } from '../../lib/labels'
import { ActionCard, AnswerEditor, Hypotheses, ImpactBoard, QuickAction } from './parts'

const PRIORITIES: Priority[] = ['now', '15min', '30min', 'verify']

interface Props {
  incident: Incident
  org: Organization
  pending: boolean
  onAnswer: (question: string, value: string) => void
  onStatus: (action: string, status: ActionStatus) => void
}

export function SituationTab({ incident, org, pending, onAnswer, onStatus }: Props) {
  const closed = incident.status === 'closed'
  const disabled = pending || closed
  const confirmed = incident.facts.filter((fact) => fact.state === 'confirmed')
  const unverified = incident.facts.filter((fact) => fact.state === 'unverified')
  const verify = incident.actions.filter((action) => action.priority === 'verify')
  const now = incident.actions.filter((action) => action.priority === 'now')
  const questions = Object.fromEntries(incident.questions.map((question) => [question.id, question]))

  return (
    <>
      <section className="situation">
        <h2 className="section-title">Obraz sytuacji</h2>
        <div className="fact-board">
          <div className="fact-col fact-col--confirmed">
            <h3>
              <Icon name="check" size={17} />
              Potwierdzone
            </h3>
            <ul>
              {confirmed.map((fact) => (
                <li key={fact.id} className="fact">
                  <span>{fact.text}</span>
                  <Pill tone={fact.source === 'kret' ? 'lamp' : 'muted'}>{fact.source}</Pill>
                </li>
              ))}
            </ul>
          </div>
          <div className="fact-col fact-col--unverified">
            <h3>
              <Icon name="alert" size={17} />
              Niezweryfikowane
            </h3>
            {unverified.length === 0 && verify.length === 0 && <p className="muted">Wszystko, co ważne, jest potwierdzone.</p>}
            <ul>
              {unverified.map((fact) => {
                const question = fact.question ? questions[fact.question] : undefined
                return (
                  <li key={fact.id} className="fact fact--open">
                    <span>{fact.text}</span>
                    {question && !closed && (
                      <div className="fact__answers" role="group" aria-label={question.text}>
                        <span className="fact__ask">{question.text}</span>
                        <div className="choice-row choice-row--tight">
                          {question.options
                            .filter((option) => option.value !== incident.answers[question.id])
                            .map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className="btn btn--ghost btn--tiny"
                                disabled={disabled}
                                onClick={() => onAnswer(question.id, option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
              {verify.map((action) => (
                <QuickAction key={action.id} action={action} disabled={disabled} onStatus={(status) => onStatus(action.id, status)} />
              ))}
            </ul>
          </div>
          <div className="fact-col fact-col--now">
            <h3>
              <Icon name="siren" size={17} />
              Działaj teraz
            </h3>
            <ul>
              {now.map((action) => (
                <QuickAction key={action.id} action={action} disabled={disabled} onStatus={(status) => onStatus(action.id, status)} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">Co mogło się stać</h2>
        <Hypotheses hypotheses={incident.hypotheses} />
      </section>

      <section>
        <h2 className="section-title">Plan pierwszych 30 minut</h2>
        <div className="plan">
          {PRIORITIES.map((priority) => {
            const actions = incident.actions.filter((action) => action.priority === priority)
            if (!actions.length) return null
            return (
              <div key={priority} className="plan__group">
                <h3 className="plan__heading">{PRIORITY_LABELS[priority]}</h3>
                <ul className="actions">
                  {actions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      org={org}
                      disabled={disabled}
                      onStatus={(status) => onStatus(action.id, status)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      <Panel title="Mapa zależności" aside={`skrzynka ${org.mailbox} jest niezaufana`}>
        <div className="panel-body">
          <ImpactBoard impact={incident.impact} org={org} />
        </div>
      </Panel>

      <Panel title="Nowe fakty" aside="zmiana odpowiedzi od razu przebudowuje plan">
        <div className="panel-body">
          <AnswerEditor questions={incident.questions} answers={incident.answers} onAnswer={onAnswer} disabled={disabled} />
        </div>
      </Panel>
    </>
  )
}
