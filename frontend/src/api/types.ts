// Mirrors backend responses (app/kret/engine.py, app/mail/analyze.py, app/incident/engine.py).

export type Level = 'ok' | 'warn' | 'bad'
export type SafeguardState = 'present' | 'missing' | 'unknown'

export interface Chamber {
  id: string
  label: string
  icon: string
  x: number
  y: number
  blurb: string
  dig: string
}

export interface Target {
  id: string
  label: string
  harm: string
  weight: number
  x: number
  y: number
}

export interface Safeguard {
  id: string
  chamber: string
  label: string
  state: SafeguardState
  source: string
  problem: string
  ok_text: string
  evidence: string
  fix: string
  effort_min: number
  cost: string
}

export interface Org {
  name: string
  domain: string
  description: string
  people: { id: string; name: string; role: string }[]
  chambers: Chamber[]
  targets: Target[]
  safeguards: Safeguard[]
  contacts: { name: string; domain: string; phone: string; note: string }[]
  fallbacks: { id: string; label: string; note: string }[]
}

export interface TunnelStep {
  technique: string
  name: string
  chamber: string
  to: string
  to_label: string
  state: 'open' | 'possible'
  narration: string
}

export interface Tunnel {
  id: string
  n: number
  target: string
  target_label: string
  harm: string
  weight: number
  state: 'open' | 'possible'
  chambers: string[]
  safeguards: string[]
  steps: TunnelStep[]
}

export interface Move {
  safeguard: string
  label: string
  chamber: string
  fix: string
  effort_min: number
  cost: string
  closes: string[]
  closes_targets: string[]
}

export interface ChamberFinding {
  chamber: string
  label: string
  dig: string
  status: Level
  items: {
    safeguard: string
    label: string
    level: Level
    text: string
    state: SafeguardState
    source: string
    source_label: string
    evidence: string
    fix: string
  }[]
}

export interface KretRun {
  id: number
  created_at: string
  label: string | null
  org: string
  tunnels: Tunnel[]
  moves: Move[]
  chambers: ChamberFinding[]
  counts: { open: number; possible: number; after_moves: number }
  summary: string
}

export interface LlmMeta {
  model: string | null
  local: boolean
  ms: number | null
  error: string | null
}

export interface KretStory {
  headline: string
  story: string
  first_step: string
  llm: LlmMeta
}

export interface Health {
  ok: boolean
  llm: { available: boolean; model: string | null; configured: string; models: string[]; mode: string }
  external_bytes: number
}

export interface DomainResult {
  domain: string
  demo: boolean
  note?: string
  provider: string | null
  findings: { key: string; level: Level; title: string; detail: string }[]
  applied: string[]
}

export interface LocalCheck {
  system: string
  hostname?: string
  supported: boolean
  note?: string
  checks: { id: string; label: string; level: Level | 'unknown'; text: string; raw: string | null; fix: string | null }[]
  applied: string[]
}

export interface Indicator {
  type: string
  severity: 'high' | 'medium' | 'info'
  title: string
  detail: string
  quote: string | null
  source: 'kret' | 'model'
}

export type Verdict = 'danger' | 'caution' | 'safe'

export interface Analysis {
  verdict: Verdict
  label: string
  level: Level
  summary: string
  what_to_do: string
  indicators: Indicator[]
  llm: LlmMeta
}

export interface Attachment {
  filename: string
  content_type: string
  size: number
}

export interface MailRow {
  id: string
  received_at: string
  from_name: string
  from_addr: string
  subject: string
  snippet: string
  attachments: Attachment[]
  scan: { verdict: Verdict; label: string; level: Level } | null
}

export interface MailMessage {
  id: string
  received_at: string
  from_name: string
  from_addr: string
  to: string[]
  reply_to: string | null
  subject: string
  date: string
  text: string
  attachments: Attachment[]
  analysis: Analysis | null
}

export interface Action {
  id: string
  title: string
  detail: string
  role: string
  role_label: string
  priority: 'now' | '15min' | '1h' | 'verify'
  priority_label: string
  safe_any_cause: boolean
  status: 'todo' | 'in_progress' | 'done'
}

export interface Hypothesis {
  label: string
  level: 'likely' | 'possible' | 'unlikely'
  explain: string
  because: string[]
  kret_warned: string | null
}

export interface ContinuityItem {
  id: string
  label: string
  critical: boolean
  top: boolean
  fallback: string
  status: 'ok' | 'fallback' | 'paused' | 'at_risk'
  confirmations: { id: string; label: string; done: boolean }[]
}

export interface Situation {
  type_label: string
  questions: { id: string; text: string; options: { value: string; label: string }[]; answer: string | null }[]
  confirmed: { text: string; source: string }[]
  unverified: { text: string; source: string }[]
  hypotheses: Record<'spoof' | 'takeover', Hypothesis>
  act_now: Action[]
  plan: Action[]
  continuity: { items: ContinuityItem[]; maintained: boolean; banner: string | null }
  map: { untrusted: string[]; at_risk: string[]; fallbacks: string[] }
  uodo: { started_at: string; deadline: string } | null
  messages: { id: string; channel: string; text: string }[]
  lessons: Safeguard[]
}

export interface Incident {
  id: number
  type: string
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  answers: Record<string, string>
  action_status: Record<string, string>
  source_mail_id: string | null
  situation: Situation
  events: { id: number; created_at: string; kind: string; message: string }[]
}

export interface IncidentRow {
  id: number
  type: string
  type_label: string
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  done: number
}
