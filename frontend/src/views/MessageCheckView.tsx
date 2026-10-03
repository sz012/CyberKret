import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Indicator, MessageCheckResult } from '../api/types'
import { Icon } from '../components/Icon'
import { ErrorNote, PageHead, Panel, Pill } from '../components/ui'
import { useAppData, useRequiredOrg } from '../lib/appData'
import { countLabel } from '../lib/format'
import { VERDICTS } from '../lib/labels'

function headline(result: MessageCheckResult): string {
  const count = result.indicators.length
  if (result.verdict === 'suspicious') {
    return `Stop. Kret znalazł ${countLabel(count, 'sygnał oszustwa', 'sygnały oszustwa', 'sygnałów oszustwa')}.`
  }
  if (result.verdict === 'likely_safe') return 'Kret nie znalazł typowych sygnałów oszustwa.'
  if (count) return `Uwaga. Kret znalazł ${countLabel(count, 'sygnał ostrzegawczy', 'sygnały ostrzegawcze', 'sygnałów ostrzegawczych')}.`
  return 'Tej wiadomości nie da się ocenić bez sprawdzenia.'
}

function HighlightedMessage({ text, indicators }: { text: string; indicators: Indicator[] }) {
  const parts: ReactNode[] = []
  let cursor = 0
  indicators.forEach((indicator, index) => {
    const start = Math.max(indicator.start, cursor)
    if (indicator.end <= start) return
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <mark key={`${indicator.start}-${index}`} className="flag" title={indicator.label}>
        {text.slice(start, indicator.end)}
        <sup>{index + 1}</sup>
      </mark>,
    )
    cursor = indicator.end
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <div className="mail-text">{parts}</div>
}

export function MessageCheckView() {
  const org = useRequiredOrg()
  const { health } = useAppData()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [analyzed, setAnalyzed] = useState('')
  const [result, setResult] = useState<MessageCheckResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const response = await api.analyzeMessage(text)
      setResult(response)
      setAnalyzed(text)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const modelReady = health?.llm.available ?? false
  const verdict = result ? VERDICTS[result.verdict] : null

  return (
    <div className="page">
      <PageHead
        depth="3 m"
        title="Kret pocztowy"
        lead="Wklej wiadomość, która budzi wątpliwości. Kret sprawdzi ją na tym komputerze i powie, co z nią zrobić."
      />

      <div className="privacy">
        <Icon name="lock" size={20} />
        <p>
          <strong>Analiza na tym komputerze.</strong> Do chmury trafia 0 bajtów. Wiadomości od klientów zawierają
          ich dane, więc nie wysyłamy ich do zewnętrznego AI.
        </p>
        <Pill tone={modelReady ? 'ok' : 'warn'} dot>
          {modelReady ? 'model lokalny + reguły' : 'same reguły, model wyłączony'}
        </Pill>
      </div>

      <div className="columns columns--mail">
        <Panel title="Wiadomość" aside="razem z nagłówkami Od i Odpowiedz do">
          <form className="panel-body form" onSubmit={analyze}>
            <label className="field">
              <span className="field__label">Treść wiadomości</span>
              <textarea
                className="input input--area"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={14}
                placeholder={'Od: ...\nOdpowiedz do: ...\nTemat: ...\n\nTreść wiadomości'}
                spellCheck={false}
              />
            </label>
            <div className="form__actions">
              <button type="submit" className="btn btn--lamp" disabled={busy || !text.trim()}>
                <Icon name="mail" size={16} />
                {busy ? 'Kret czyta…' : 'Sprawdź wiadomość'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setText(org.sample_message)}>
                Wklej przykład z demo
              </button>
              {text && (
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => {
                    setText('')
                    setResult(null)
                  }}
                >
                  Wyczyść
                </button>
              )}
            </div>
            {busy && modelReady && <p className="muted">Model lokalny myśli. Pierwsze uruchomienie trwa dłużej.</p>}
            {error && <ErrorNote message={error} />}
          </form>
        </Panel>

        <Panel
          title="Werdykt kreta"
          aside={
            verdict ? (
              <Pill tone={verdict.tone} dot>
                {verdict.label}
              </Pill>
            ) : undefined
          }
          className={result ? `verdict verdict--${result.verdict}` : 'verdict'}
        >
          {result ? (
            <div className="panel-body">
              <div className={`stop stop--${verdict?.tone}`}>
                <strong>{headline(result)}</strong>
                <p>{result.summary}</p>
                {result.indicators.length > 0 && (
                  <ol>
                    {result.indicators.map((indicator, index) => (
                      <li key={`${indicator.type}-${index}`}>
                        <b>{indicator.label}.</b> {indicator.explanation}
                        {indicator.source === 'model' && <span className="stop__source"> (model)</span>}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="stop__do">
                  <b>Co zrobić:</b> {result.advice}
                </p>
              </div>
              <HighlightedMessage text={analyzed} indicators={result.indicators} />
              <div className="verdict__foot">
                <span className="muted">
                  {result.mode === 'model' ? `Reguły i model lokalny (${result.model}).` : (result.note ?? 'Wynik z reguł.')}
                </span>
                {result.verdict !== 'likely_safe' && (
                  <button
                    type="button"
                    className="btn btn--sos"
                    onClick={() => navigate('/incydenty/nowy', { state: { facts: result.facts } })}
                  >
                    <Icon name="siren" size={17} />
                    Zgłoś incydent z tymi faktami
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-body verdict__empty">
              <p className="muted">
                Kret zaznaczy w treści to, co budzi wątpliwości, i wyjaśni dlaczego. Każdy cytat pochodzi z
                wiadomości, nic nie jest zmyślone.
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
