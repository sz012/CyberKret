export type SafeguardState = 'present' | 'missing' | 'unknown'
export type SafeguardSource = 'kret' | 'answers'
export type PathStatus = 'open' | 'possible'
export type SegmentStatus = 'open' | 'possible' | 'closed'
export type Priority = 'now' | '15min' | '30min' | 'verify'
export type Phase = 'stop' | 'assess' | 'notify' | 'continue' | 'learn'
export type ActionStatus = 'todo' | 'in_progress' | 'done'
export type Likelihood = 'likely' | 'possible' | 'unlikely'
export type ActivityStatus = 'ok' | 'fallback' | 'at_risk' | 'paused' | 'pending'
export type Verdict = 'suspicious' | 'likely_safe' | 'unclear'
export type FindingStatus = 'ok' | 'warn' | 'bad' | 'info' | 'unknown'

export interface Service {
  id: string
  name: string
  description: string
  layer: 'surface' | 'fallback'
  icon: string
}

export interface Dependency {
  source: string
  target: string
  label: string
  kind: 'depends' | 'fallback'
}

export interface Safeguard {
  id: string
  service: string
  label: string
  fix: string
  why: string
  state: SafeguardState
  source: SafeguardSource
  effort_minutes: number
}

export interface Person {
  id: string
  name: string
  role: string
}

export interface Channel {
  id: string
  name: string
  description: string
  service: string | null
}

export interface MessageTemplate {
  id: string
  title: string
  text: string
}

export interface Confirmation {
  id: string
  label: string
}

export interface Activity {
  id: string
  name: string
  note: string
  critical: boolean
  depends_on: string[]
  normally: string
  fallback: string | null
  confirmations: Confirmation[]
}

export interface DomainFinding {
  id: string
  label: string
  status: FindingStatus
  detail: string
}

export interface DomainCheck {
  domain: string
  checked_at: string
  demo: boolean
  mail_provider: string | null
  findings: DomainFinding[]
}

export interface Organization {
  id: string
  name: string
  domain: string
  mailbox: string
  description: string
  today_note: string
  continuity_ok: string
  sample_message: string
  services: Service[]
  dependencies: Dependency[]
  safeguards: Safeguard[]
  people: Person[]
  channels: Channel[]
  templates: MessageTemplate[]
  activities: Activity[]
  domain_check: DomainCheck | null
}

export interface KretPosition {
  id: string
  label: string
  kind: 'entry' | 'foothold' | 'target'
  description: string
}

export interface KretStep {
  technique: string
  name: string
  source: string
  target: string
  narrative: string
  requires: string[]
  unknown: string[]
}

export interface KretPath {
  id: string
  target: string
  status: PathStatus
  steps: KretStep[]
}

export interface KretMove {
  safeguard: string
  fix: string
  why: string
  closes: number
  effort_minutes: number
  paths: string[]
}

export interface KretTarget {
  id: string
  label: string
  description: string
  open: number
  possible: number
}

export interface SafeguardRef {
  id: string
  label: string
  source: SafeguardSource
}

export interface KretStory {
  target: string
  title: string
  path: string
  lines: string[]
}

export interface KretSegment {
  source: string
  target: string
  status: SegmentStatus
  techniques: string[]
  names: string[]
}

export interface KretResult {
  id: number | null
  created_at: string
  total: number
  possible: number
  remaining_after_moves: number
  moves_minutes: number
  paths: KretPath[]
  moves: KretMove[]
  targets: KretTarget[]
  good: SafeguardRef[]
  unknown: SafeguardRef[]
  intro: string
  outro: string
  stories: KretStory[]
  positions: KretPosition[]
  segments: KretSegment[]
}

export interface DomainCheckResponse {
  check: DomainCheck
  applied: boolean
}

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: string
  text: string
  short: string
  help: string
  options: QuestionOption[]
  in_form: boolean
}

export interface IncidentType {
  id: string
  label: string
  description: string
  available: boolean
}

export interface IncidentCatalog {
  types: IncidentType[]
  questions: Question[]
  defaults: Record<string, string>
}

export interface Fact {
  id: string
  text: string
  state: 'confirmed' | 'unverified'
  source: string
  question: string | null
}

export interface Hypothesis {
  id: string
  label: string
  likelihood: Likelihood
  reason: string
  kret_warned: string | null
}

export interface Action {
  id: string
  title: string
  detail: string
  priority: Priority
  phase: Phase
  role: string
  safe_any_cause: boolean
  tag: string | null
  template: string | null
  status: ActionStatus
}

export interface PhaseProgress {
  id: Phase
  label: string
  done: number
  total: number
}

export interface ImpactService {
  service: string
  name: string
  reason: string
}

export interface Impact {
  untrusted: ImpactService[]
  threatened: ImpactService[]
  unsafe: string[]
  fallbacks: ImpactService[]
}

export interface ConfirmationState {
  id: string
  label: string
  done: boolean
}

export interface ActivityState {
  id: string
  name: string
  note: string
  critical: boolean
  status: ActivityStatus
  normally: string
  fallback: string | null
  confirmations: ConfirmationState[]
}

export interface Continuity {
  maintained: boolean
  headline: string
  detail: string
  missing: number
  activities: ActivityState[]
}

export interface Clock {
  id: string
  label: string
  started_at: string
  due_at: string
}

export interface Lesson {
  safeguard: string
  fix: string
  why: string
  reason: string
  state: SafeguardState
}

export interface LogEntry {
  id: number
  incident_id: number | null
  created_at: string
  kind: string
  message: string
}

export interface IncidentSummary {
  id: number
  type: string
  type_label: string
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  done: number
  total: number
}

export interface Incident {
  id: number
  type: string
  type_label: string
  status: 'open' | 'closed'
  created_at: string
  closed_at: string | null
  answers: Record<string, string>
  questions: Question[]
  facts: Fact[]
  hypotheses: Hypothesis[]
  actions: Action[]
  phases: PhaseProgress[]
  impact: Impact
  continuity: Continuity
  clocks: Clock[]
  lessons: Lesson[]
  log: LogEntry[]
}

export interface LessonsResult {
  applied: string[]
  before: KretResult
  after: KretResult
}

export interface Indicator {
  type: string
  label: string
  quote: string
  explanation: string
  source: 'rules' | 'model'
  start: number
  end: number
}

export interface MessageCheckResult {
  verdict: Verdict
  summary: string
  advice: string
  indicators: Indicator[]
  facts: string[]
  mode: 'model' | 'rules'
  model: string | null
  note: string | null
}

export interface Health {
  status: string
  llm: { available: boolean; model: string }
}
