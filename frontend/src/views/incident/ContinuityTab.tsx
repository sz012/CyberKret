import type { Incident, Organization } from '../../api/types'
import { Icon } from '../../components/Icon'
import { CopyButton, Panel, Pill } from '../../components/ui'
import { ACTIVITY_STATUS } from '../../lib/labels'

interface Props {
  incident: Incident
  org: Organization
  pending: boolean
  onConfirm: (item: string, done: boolean) => void
}

export function ContinuityTab({ incident, org, pending, onConfirm }: Props) {
  const { continuity } = incident
  const closed = incident.status === 'closed'
  return (
    <>
      <div className={`continuity-banner ${continuity.maintained ? 'is-ok' : 'is-pending'}`} role="status">
        <Icon name={continuity.maintained ? 'shield' : 'alert'} size={28} />
        <div>
          <strong>{continuity.headline}</strong>
          <span>{continuity.detail}</span>
        </div>
      </div>

      <section>
        <h2 className="section-title">Jak biuro działa dziś, mimo incydentu</h2>
        <div className="activities">
          {continuity.activities.map((activity) => {
            const status = ACTIVITY_STATUS[activity.status]
            return (
              <article key={activity.id} className={`activity activity--${activity.status}`}>
                <header>
                  <h3>{activity.name}</h3>
                  <Pill tone={status.tone} dot>
                    {status.label}
                  </Pill>
                </header>
                <p className="activity__note">
                  {activity.note}
                  {!activity.critical && ' Nie blokuje dzisiejszej pracy.'}
                </p>
                <dl className="activity__channels">
                  <div>
                    <dt>Normalnie</dt>
                    <dd>{activity.normally}</dd>
                  </div>
                  <div>
                    <dt>Zastępczo</dt>
                    <dd>{activity.fallback ?? 'nie potrzeba, nie zależy od poczty'}</dd>
                  </div>
                </dl>
                <ul className="confirmations">
                  {activity.confirmations.map((item) => (
                    <li key={item.id}>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={item.done}
                          disabled={pending || closed}
                          onChange={() => onConfirm(item.id, !item.done)}
                        />
                        <span>{item.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </section>

      <div className="columns">
        <Panel title="Gotowe komunikaty" aside="skopiuj i wyślij kanałem zastępczym">
          <ul className="panel-body templates">
            {org.templates.map((template) => (
              <li key={template.id} className="template">
                <div className="template__head">
                  <strong>{template.title}</strong>
                  <CopyButton text={template.text} />
                </div>
                <p>{template.text}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Kanały zastępcze" aside="ustalone przed incydentem">
          <ul className="panel-body channels">
            {org.channels.map((channel) => (
              <li key={channel.id}>
                <Icon name={org.services.find((service) => service.id === channel.service)?.icon ?? 'broadcast'} size={18} />
                <div>
                  <strong>{channel.name}</strong>
                  <span>{channel.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
