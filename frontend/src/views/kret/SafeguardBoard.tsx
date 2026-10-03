import type { Organization, SafeguardState } from '../../api/types'
import { Icon } from '../../components/Icon'
import { Panel, Pill, Segmented } from '../../components/ui'
import { formatMinutes } from '../../lib/format'
import { SAFEGUARD_STATES, SOURCE_LABELS } from '../../lib/labels'

export function SafeguardBoard({
  org,
  onChange,
  busy,
}: {
  org: Organization
  onChange: (safeguard: string, state: SafeguardState) => void
  busy: boolean
}) {
  const groups = org.services
    .map((service) => ({ service, items: org.safeguards.filter((s) => s.service === service.id) }))
    .filter((group) => group.items.length)

  return (
    <Panel title="Zabezpieczenia biura" aside="zmiana od razu przelicza tunele">
      <div className="safeguards">
        {groups.map(({ service, items }) => (
          <section key={service.id} className="safeguards__group">
            <h3 className="safeguards__service">
              <Icon name={service.icon} size={18} />
              {service.name}
            </h3>
            <ul>
              {items.map((safeguard) => (
                <li key={safeguard.id} className={`safeguard safeguard--${safeguard.state}`}>
                  <div className="safeguard__text">
                    <span className="safeguard__label">{safeguard.label}</span>
                    <span className="safeguard__why">{safeguard.why}</span>
                    <span className="safeguard__meta">
                      <Pill tone={safeguard.source === 'kret' ? 'lamp' : 'muted'}>{SOURCE_LABELS[safeguard.source]}</Pill>
                      <Pill tone="muted">poprawka: {formatMinutes(safeguard.effort_minutes)}</Pill>
                    </span>
                  </div>
                  <Segmented
                    label={safeguard.label}
                    options={SAFEGUARD_STATES}
                    value={safeguard.state}
                    onChange={(state) => onChange(safeguard.id, state)}
                    disabled={busy}
                    size="small"
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  )
}
