import type {
  ActionStatus,
  ActivityStatus,
  FindingStatus,
  Likelihood,
  Priority,
  SafeguardSource,
  SafeguardState,
  Verdict,
} from '../api/types'

export type Tone = 'ok' | 'warn' | 'bad' | 'lamp' | 'muted'

export const PRIORITY_LABELS: Record<Priority, string> = {
  now: 'Natychmiast',
  '15min': 'W ciągu 15 minut',
  '30min': 'W ciągu 30 minut',
  verify: 'Do potwierdzenia',
}

export const PRIORITY_SHORT: Record<Priority, string> = {
  now: 'teraz',
  '15min': '15 min',
  '30min': '30 min',
  verify: 'sprawdź',
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  todo: 'Do zrobienia',
  in_progress: 'W toku',
  done: 'Zrobione',
}

export const LIKELIHOOD: Record<Likelihood, { label: string; level: number; tone: Tone }> = {
  likely: { label: 'prawdopodobne', level: 3, tone: 'bad' },
  possible: { label: 'możliwe', level: 2, tone: 'warn' },
  unlikely: { label: 'mało prawdopodobne', level: 1, tone: 'muted' },
}

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; tone: Tone }> = {
  ok: { label: 'działa', tone: 'ok' },
  fallback: { label: 'działa zastępczo', tone: 'lamp' },
  at_risk: { label: 'zagrożone', tone: 'bad' },
  paused: { label: 'wstrzymane', tone: 'muted' },
  pending: { label: 'do potwierdzenia', tone: 'warn' },
}

export const SAFEGUARD_STATES: { value: SafeguardState; label: string }[] = [
  { value: 'present', label: 'Jest' },
  { value: 'missing', label: 'Brak' },
  { value: 'unknown', label: 'Nie wiem' },
]

export const SOURCE_LABELS: Record<SafeguardSource, string> = {
  kret: 'sprawdził kret',
  answers: 'z Waszych odpowiedzi',
}

export const VERDICTS: Record<Verdict, { label: string; tone: Tone }> = {
  suspicious: { label: 'nie płać, zgłoś', tone: 'bad' },
  unclear: { label: 'sprawdź, zanim zapłacisz', tone: 'warn' },
  likely_safe: { label: 'bez typowych sygnałów', tone: 'ok' },
}

export const FINDING_TONES: Record<FindingStatus, Tone> = {
  ok: 'ok',
  warn: 'warn',
  bad: 'bad',
  info: 'muted',
  unknown: 'muted',
}

export const FINDING_LABELS: Record<FindingStatus, string> = {
  ok: 'w porządku',
  warn: 'do poprawy',
  bad: 'problem',
  info: 'informacja',
  unknown: 'nie wiadomo',
}
