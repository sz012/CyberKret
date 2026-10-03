import { useEffect, useMemo, useRef, useState } from 'react'
import type { ZxcvbnFactory } from '@zxcvbn-ts/core'

const STRENGTH = ['bardzo słabe', 'słabe', 'średnie', 'dobre', 'bardzo dobre']
const LEVEL = ['bad', 'bad', 'warn', 'ok', 'ok']

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

function companyWords(...parts: string[]): string[] {
  const words = parts.join(' ').toLowerCase().split(/[^a-ząćęłńóśźż0-9]+/)
  return [...new Set(words.filter((word) => word.length > 2))]
}

export default function PasswordCheckCard({ name, domain }: { name: string; domain: string }) {
  const words = useMemo(() => companyWords(name, domain), [name, domain])
  const [password, setPassword] = useState('')
  const [checked, setChecked] = useState<Strength | null>(null)
  const checker = useRef<Promise<ZxcvbnFactory> | null>(null)
  const strength = checked && checked.password === password ? checked : null

  useEffect(() => {
    if (!password) return
    let alive = true
    const timer = setTimeout(async () => {
      checker.current ??= createChecker()
      const result = (await checker.current).check(password, words)
      if (!alive) return
      setChecked({
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
    <div className="card">
      <div className="card-head"><h3>Sprawdź siłę hasła</h3><span className="src kret">tylko w przeglądarce</span></div>
      <div className="card-pad stack">
        <p className="muted small">Hasło nie opuszcza tej karty przeglądarki. Nie trafia na serwer, do dziennika ani do modelu.</p>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Wpisz hasło"
          aria-label="Hasło do sprawdzenia"
          autoComplete="off"
          spellCheck={false}
        />
        {strength && (
          <div className="strength" aria-live="polite">
            <div className={`strength-bar s${strength.score}`} aria-hidden="true">
              {STRENGTH.map((label, i) => <span key={label} className={i <= strength.score ? 'on' : undefined} />)}
            </div>
            <p className="small">
              <b className={LEVEL[strength.score]}>Hasło {STRENGTH[strength.score]}.</b>{' '}
              <span className="muted">Złamanie przy wycieku zajęłoby: {strength.crackTime}.</span>
            </p>
            {strength.warning && <p className="small warn">{strength.warning}</p>}
            {strength.suggestions.length > 0 && (
              <ul className="mini-findings">
                {strength.suggestions.map((tip) => <li key={tip} className="muted small">{tip}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
