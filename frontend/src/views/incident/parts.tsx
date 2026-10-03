import { useState } from 'react'
import type { Action, ActionStatus, Hypothesis, Impact, MessageTemplate, Organization, PhaseProgress, Question } from '../../api/types'
import { Icon } from '../../components/Icon'
import { CopyButton, Pill, Segmented } from '../../components/ui'
import { ACTION_STATUS_LABELS, LIKELIHOOD, PRIORITY_SHORT } from '../../lib/labels'

const STATUS_OPTIONS = (Object.keys(ACTION_STATUS_LABELS) as ActionStatus[]).map((value) => ({
  value,
  label: ACTION_STATUS_LABELS[value],
}))

const PHASE_LABELS: Record<string, string> = {
  stop: 'zatrzymaj',
  assess: 'oceń',
  notify: 'zawiadom',
  continue: 'utrzymaj działanie',
  learn: 'wnioski',
}

export function PhaseStrip({ phases, closed = false }: { phases: PhaseProgress[]; closed?: boolean }) {
  const current = closed ? -1 : phases.findIndex((phase) => phase.total > 0 && phase.done < phase.total)
  return (
    <ol className="phases" aria-label="Korytarze incydentu">
      {phases.map((phase, index) => {
        const complete = phase.total > 0 && phase.done >= phase.total
        const state = complete ? 'is-done' : index === current ? 'is-current' : ''
        return (
          <li key={phase.id} className={`phase ${state}`}>
            <span className="phase__n">{complete ? <Icon name="check" size={14} /> : index + 1}</span>
            <span className="phase__label">{phase.label}</span>
            <span className="phase__count">
              {phase.done}/{phase.total}
            </span>
            <span className="phase__bar" aria-hidden="true">
              <span style={{ width: `${phase.total ? (phase.done / phase.total) * 100 : 0}%` }} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function Hypotheses({ hypotheses }: { hypotheses: Hypothesis[] }) {
  return (
    <div className="hypotheses">
      {hypotheses.map((hypothesis) => {
        const meta = LIKELIHOOD[hypothesis.likelihood]
        return (
          <article key={hypothesis.id} className={`hypothesis hypothesis--${hypothesis.likelihood}`}>
            <header>
              <h3>{hypothesis.label}</h3>
              <span className="meter" aria-label={`Ocena: ${meta.label}`}>
                {[1, 2, 3].map((level) => (
                  <span key={level} className={level <= meta.level ? `is-on is-${meta.tone}` : undefined} />
                ))}
                <span className="meter__label">{meta.label}</span>
              </span>
            </header>
            <p>{hypothesis.reason}</p>
            {hypothesis.kret_warned && (
              <p className="kret-warned">
                <Icon name="alert" size={15} />
                {hypothesis.kret_warned}
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}

function TemplateBox({ template }: { template: MessageTemplate }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="template-box">
      <button type="button" className="btn btn--quiet btn--tiny" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="file" size={14} />
        {open ? 'Ukryj tekst' : `Gotowy tekst: ${template.title.toLowerCase()}`}
      </button>
      {open && (
        <div className="template-box__body">
          <p>{template.text}</p>
          <CopyButton text={template.text} />
        </div>
      )}
    </div>
  )
}

export function ActionCard({
  action,
  org,
  onStatus,
  disabled,
}: {
  action: Action
  org: Organization
  onStatus: (status: ActionStatus) => void
  disabled: boolean
}) {
  const template = action.template ? org.templates.find((item) => item.id === action.template) : undefined
  return (
    <li className={`action action--${action.status}`}>
      <span className={`action__time action__time--${action.priority}`}>{PRIORITY_SHORT[action.priority]}</span>
      <div className="action__body">
        <h4>{action.title}</h4>
        <p>{action.detail}</p>
        <div className="action__meta">
          <Pill tone="muted">
            <Icon name="user" size={13} />
            {action.role}
          </Pill>
          <Pill tone="muted">{PHASE_LABELS[action.phase]}</Pill>
          {action.tag && <Pill tone="warn">{action.tag}</Pill>}
          {action.safe_any_cause && <Pill tone="ok">bezpieczne niezależnie od przyczyny</Pill>}
        </div>
        {template && <TemplateBox template={template} />}
      </div>
      <div className="action__status">
        <Segmented label={`Status: ${action.title}`} options={STATUS_OPTIONS} value={action.status} onChange={onStatus} disabled={disabled} size="small" />
      </div>
    </li>
  )
}

export function QuickAction({
  action,
  onStatus,
  disabled,
}: {
  action: Action
  onStatus: (status: ActionStatus) => void
  disabled: boolean
}) {
  const done = action.status === 'done'
  return (
    <li className={`quick quick--${action.status}`}>
      <label className="check">
        <input type="checkbox" checked={done} disabled={disabled} onChange={() => onStatus(done ? 'todo' : 'done')} />
        <span>
          <strong>{action.title}</strong>
          <span className="quick__role">{action.role}</span>
        </span>
      </label>
    </li>
  )
}

export function ImpactBoard({ impact, org }: { impact: Impact; org: Organization }) {
  const icon = (service: string) => org.services.find((item) => item.id === service)?.icon ?? 'shield'
  return (
    <div className="impact">
      <div className="impact__col">
        <h4>Niezaufane</h4>
        {impact.untrusted.map((item) => (
          <div key={item.service} className="impact-card impact-card--bad">
            <Icon name={icon(item.service)} size={18} />
            <div>
              <strong>{item.name}</strong>
              <span>{item.reason}</span>
            </div>
          </div>
        ))}
      </div>
      <Icon name="arrow" size={22} className="impact__arrow" />
      <div className="impact__col">
        <h4>Zagrożone</h4>
        {impact.threatened.map((item) => (
          <div key={item.service} className="impact-card impact-card--warn">
            <Icon name={icon(item.service)} size={18} />
            <div>
              <strong>{item.name}</strong>
              <span>przez: {item.reason}</span>
            </div>
          </div>
        ))}
      </div>
      <Icon name="arrow" size={22} className="impact__arrow" />
      <div className="impact__col">
        <h4>Kanały zastępcze</h4>
        {impact.fallbacks.map((item) => (
          <div key={item.service} className="impact-card impact-card--lamp">
            <Icon name={icon(item.service)} size={18} />
            <div>
              <strong>{item.name}</strong>
              <span>{item.reason}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="impact__unsafe">
        <h4>Przestaje być bezpieczne</h4>
        <ul>
          {impact.unsafe.map((line) => (
            <li key={line}>
              <Icon name="close" size={14} />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AnswerEditor({
  questions,
  answers,
  onAnswer,
  disabled,
}: {
  questions: Question[]
  answers: Record<string, string>
  onAnswer: (question: string, value: string) => void
  disabled: boolean
}) {
  return (
    <div className="answers">
      {questions.map((question) => (
        <div key={question.id} className="answers__row">
          <div>
            <span className="answers__question">{question.text}</span>
            <span className="answers__help">{question.help}</span>
          </div>
          <Segmented
            label={question.text}
            options={question.options}
            value={answers[question.id]}
            onChange={(value) => onAnswer(question.id, value)}
            disabled={disabled}
            size="small"
          />
        </div>
      ))}
    </div>
  )
}
