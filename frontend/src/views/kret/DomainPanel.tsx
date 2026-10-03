import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../../api/client'
import type { DomainCheck, Organization } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ErrorNote, Panel, Pill } from '../../components/ui'
import { formatDateTime } from '../../lib/format'
import { FINDING_LABELS, FINDING_TONES } from '../../lib/labels'

export function DomainPanel({ org, onApplied }: { org: Organization; onApplied: () => Promise<void> }) {
  const [domain, setDomain] = useState(org.domain)
  const [consent, setConsent] = useState(false)
  const [check, setCheck] = useState<DomainCheck | null>(org.domain_check)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await api.checkDomain(domain, consent)
      setCheck(response.check)
      if (response.applied) await onApplied()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Domena i poczta" aside="sprawdzenie pasywne">
      <form className="panel-body form" onSubmit={submit}>
        <p className="muted">
          Kret czyta publiczne rekordy DNS i stronę główną. Nie skanuje portów, nie zgaduje haseł i niczego nie
          loguje.
        </p>
        <label className="field">
          <span className="field__label">Domena</span>
          <input
            className="input"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="twojafirma.pl"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>To nasza domena albo mamy zgodę właściciela.</span>
        </label>
        <div className="form__actions">
          <button type="submit" className="btn btn--lamp btn--small" disabled={busy || !consent || !domain.trim()}>
            <Icon name="globe" size={15} />
            {busy ? 'Sprawdzam…' : 'Sprawdź domenę'}
          </button>
        </div>
        {error && <ErrorNote message={error} />}
      </form>
      {check && (
        <div className="panel-body panel-body--top">
          <div className="findings__head">
            <strong>{check.domain}</strong>
            <span className="muted">{formatDateTime(check.checked_at)}</span>
            {check.demo && <Pill tone="lamp">dane demonstracyjne</Pill>}
          </div>
          <ul className="findings">
            {check.findings.map((finding) => (
              <li key={finding.id} className="finding">
                <Pill tone={FINDING_TONES[finding.status]} dot>
                  {FINDING_LABELS[finding.status]}
                </Pill>
                <div>
                  <strong>{finding.label}</strong>
                  <p>{finding.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
