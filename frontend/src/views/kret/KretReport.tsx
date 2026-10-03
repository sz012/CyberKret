import { useEffect, useRef } from 'react'
import type { KretResult, SafeguardState } from '../../api/types'
import { Icon } from '../../components/Icon'
import { Mascot } from '../../components/Mascot'
import { Pill } from '../../components/ui'
import { countLabel, formatMinutes, plural } from '../../lib/format'
import { SOURCE_LABELS } from '../../lib/labels'
import type { DigLine } from '../../map/lines'

export function KretConsole({ lines }: { lines: DigLine[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [lines])
  return (
    <ol className="console" ref={listRef} aria-live="polite" aria-label="Dziennik kreta">
      {lines.map((line, index) => (
        <li key={`${index}-${line.text}`} className={line.tone ? `console__line--${line.tone}` : undefined}>
          {line.text}
        </li>
      ))}
    </ol>
  )
}

export function MapLegend() {
  return (
    <ul className="legend" aria-label="Legenda mapy">
      <li>
        <span className="legend__swatch legend__swatch--open" /> droga otwarta
      </li>
      <li>
        <span className="legend__swatch legend__swatch--possible" /> droga niepewna
      </li>
      <li>
        <span className="legend__swatch legend__swatch--closed" /> zasypana
      </li>
    </ul>
  )
}

export function Moves({
  result,
  onDone,
  busy,
}: {
  result: KretResult
  onDone: (safeguard: string) => void
  busy: boolean
}) {
  if (!result.total) {
    return (
      <div className="state state--empty">
        <Mascot mood="happy" beam={false} className="state__mole" />
        <div>
          <h3>Nie ma czego zasypywać</h3>
          <p>Kret nie znalazł otwartej drogi. Wpuśćcie go ponownie po każdej zmianie w biurze.</p>
        </div>
      </div>
    )
  }
  const remaining = result.remaining_after_moves
  return (
    <>
      <ol className="tasks">
        {result.moves.map((move, index) => (
          <li key={move.safeguard}>
            <span className="tasks__n">{index + 1}</span>
            <div>
              <h4>{move.fix}</h4>
              <p>{move.why}</p>
              <div className="tasks__meta">
                <Pill tone="bad" dot>
                  zamyka {move.closes} z {result.total} {result.total === 1 ? 'drogi' : 'dróg'}
                </Pill>
                <Pill tone="lamp">{formatMinutes(move.effort_minutes)}</Pill>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => onDone(move.safeguard)}
                  disabled={busy}
                >
                  <Icon name="check" size={15} />
                  Zrobione
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <p className="tasks__total">
        Razem około {formatMinutes(result.moves_minutes)}.{' '}
        {remaining === 0
          ? 'Po tych ruchach nie zostaje żadna otwarta droga.'
          : `Po tych ruchach ${plural(remaining, 'zostaje', 'zostają', 'zostaje')} ${countLabel(remaining, 'droga', 'drogi', 'dróg')}.`}
      </p>
    </>
  )
}

export function Stories({
  result,
  highlight,
  onHighlight,
}: {
  result: KretResult
  highlight: string | null
  onHighlight: (path: string | null) => void
}) {
  return (
    <div className="panel-body">
      <p className="story-intro">{result.intro}</p>
      {result.stories.length > 0 && (
        <ul className="stories">
          {result.stories.map((story) => {
            const target = result.targets.find((t) => t.id === story.target)
            const tone = target?.open ? 'bad' : 'warn'
            const active = highlight === story.path
            return (
              <li
                key={story.target}
                className={`story story--${tone}${active ? ' is-active' : ''}`}
                onMouseEnter={() => onHighlight(story.path)}
                onMouseLeave={() => onHighlight(null)}
              >
                <button
                  type="button"
                  className="story__head"
                  aria-pressed={active}
                  onClick={() => onHighlight(active ? null : story.path)}
                  onFocus={() => onHighlight(story.path)}
                  onBlur={() => onHighlight(null)}
                >
                  <span className="story__title">{story.title}</span>
                  <span className="story__hint">
                    <Icon name="layers" size={14} />
                    pokaż na mapie
                  </span>
                </button>
                <ol className="story__lines">
                  {story.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </li>
            )
          })}
        </ul>
      )}
      <p className="note">
        Kret niczego nie atakuje naprawdę. To symulacja na podstawie mapy biura i publicznych rekordów domeny.
      </p>
    </div>
  )
}

export function KnownAndUnknown({
  result,
  onSet,
  busy,
}: {
  result: KretResult
  onSet: (safeguard: string, state: SafeguardState) => void
  busy: boolean
}) {
  return (
    <div className="split">
      <div>
        <h3 className="subhead">Co jest dobrze</h3>
        {result.good.length ? (
          <ul className="checklist">
            {result.good.map((item) => (
              <li key={item.id}>
                <Icon name="check" size={16} className="checklist__icon checklist__icon--ok" />
                <span>{item.label}</span>
                <Pill tone="muted">{SOURCE_LABELS[item.source]}</Pill>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Jeszcze nic. Każde zabezpieczenie oznaczone jako „jest” pojawi się tutaj.</p>
        )}
      </div>
      <div>
        <h3 className="subhead">Czego kret nie wie</h3>
        {result.unknown.length ? (
          <ul className="checklist">
            {result.unknown.map((item) => (
              <li key={item.id}>
                <Icon name="alert" size={16} className="checklist__icon checklist__icon--warn" />
                <span>{item.label}</span>
                <span className="checklist__actions">
                  <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={() => onSet(item.id, 'present')}>
                    Jest
                  </button>
                  <button type="button" className="btn btn--ghost btn--tiny" disabled={busy} onClick={() => onSet(item.id, 'missing')}>
                    Brak
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Kret wie wszystko, czego potrzebuje.</p>
        )}
      </div>
    </div>
  )
}
