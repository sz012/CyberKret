import { useEffect, useMemo, useRef, useState } from 'react'
import type { ZxcvbnFactory } from '@zxcvbn-ts/core'
import { Icon } from '../../components/Icon'
import { Panel } from '../../components/ui'
import { useRequiredOrg } from '../../lib/appData'

const STRENGTH = ['bardzo słabe', 'słabe', 'średnie', 'dobre', 'bardzo dobre']

interface Strength {
  password: string
  score: number
  warning: string | null
  suggestions: string[]
  crackTime: string
}

async function createChecker(): Promise<ZxcvbnFactory> {
  const [core, common, polish] = await Promise.all([
    import('@zxcvbn-ts/core'),
    import('@zxcvbn-ts/language-common'),
    import('@zxcvbn-ts/language-pl'),
  ])
  return new core.ZxcvbnFactory({
    translations: polish.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...polish.dictionary },
  })
}

function companyWords(name: string, domain: string, mailbox: string): string[] {
  const words = `${name} ${domain} ${mailbox}`.toLowerCase().split(/[^a-ząćęłńóśźż0-9]+/)
  return [...new Set(words.filter((word) => word.length > 2))]
}

export function PasswordPanel() {
  const org = useRequiredOrg()
  const words = useMemo(() => companyWords(org.name, org.domain, org.mailbox), [org.name, org.domain, org.mailbox])
  const [password, setPassword] = useState('')
  const [checked, setStrength] = useState<Strength | null>(null)
  const checker = useRef<Promise<ZxcvbnFactory> | null>(null)
  const strength = checked && checked.password === password ? checked : null

  useEffect(() => {
    if (!password) return
    let alive = true
    const timer = setTimeout(async () => {
      checker.current ??= createChecker()
      const result = (await checker.current).check(password, words)
      if (!alive) return
      setStrength({
        password,
        score: result.score,
        warning: result.feedback.warning,
        suggestions: result.feedback.suggestions,
        crackTime: result.crackTimes.offlineSlowHashingXPerSecond.display,
      })
    }, 160)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [password, words])

  return (
    <Panel title="Siła hasła" aside="tylko w tej przeglądarce">
      <div className="panel-body form">
        <p className="muted">
          Hasło nie opuszcza tej karty przeglądarki. Nie trafia na serwer, do dziennika ani do modelu.
        </p>
        <label className="field">
          <span className="field__label">Hasło do sprawdzenia</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        {strength && (
          <div className={`strength strength--${strength.score}`} aria-live="polite">
            <div className="strength__bar" aria-hidden="true">
              {STRENGTH.map((label, index) => (
                <span key={label} className={index <= strength.score ? 'is-on' : undefined} />
              ))}
            </div>
            <p>
              <strong>Hasło {STRENGTH[strength.score]}.</strong> Złamanie przy wycieku zajęłoby: {strength.crackTime}.
            </p>
            {strength.warning && (
              <p className="strength__warning">
                <Icon name="alert" size={15} />
                {strength.warning}
              </p>
            )}
            {strength.suggestions.length > 0 && (
              <ul className="strength__tips">
                {strength.suggestions.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Panel>
  )
}
