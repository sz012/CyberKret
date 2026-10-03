import { useEffect, useState, type ReactNode } from 'react'
import { formatCountdown } from '../lib/format'
import type { Tone } from '../lib/labels'
import { Icon } from './Icon'
import { Mascot } from './Mascot'

export function Pill({ tone = 'muted', children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`pill pill--${tone}`}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Panel({
  title,
  aside,
  children,
  className,
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className ? `panel ${className}` : 'panel'}>
      {(title || aside) && (
        <header className="panel-head">
          <span>{title}</span>
          {aside && <span className="panel-head__aside">{aside}</span>}
        </header>
      )}
      {children}
    </section>
  )
}

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  size = 'normal',
}: {
  options: SegmentedOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  size?: 'normal' | 'small'
}) {
  return (
    <div className={`segmented segmented--${size}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__option segmented__option--${option.value}`}
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => option.value !== value && onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function PageHead({
  depth,
  title,
  lead,
  actions,
}: {
  depth: string
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        <span className="depth-chip">{depth}</span>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  )
}

export function Loading({ label = 'Kret kopie…' }: { label?: string }) {
  return (
    <div className="state state--loading" role="status">
      <Mascot mood="dig" beam={false} className="state__mole" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <Icon name="alert" size={22} />
      <div>
        <p>{message}</p>
        {onRetry && (
          <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state--empty">
      <Mascot mood="calm" beam={false} className="state__mole" />
      <div>
        <h3>{title}</h3>
        {children && <p>{children}</p>}
        {action}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Kopiuj' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" className="btn btn--ghost btn--small" onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {copied ? 'Skopiowano' : label}
    </button>
  )
}

export function Countdown({ dueAt, label }: { dueAt: string; label: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const left = new Date(dueAt).getTime() - now
  return (
    <span className={`countdown${left < 12 * 3600 * 1000 ? ' countdown--urgent' : ''}`} title={label}>
      <Icon name="clock" size={15} />
      <span className="countdown__label">{label}</span>
      <span className="countdown__value">{formatCountdown(left)}</span>
    </span>
  )
}
