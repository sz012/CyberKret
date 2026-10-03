import type {
  ActionStatus,
  DomainCheckResponse,
  Health,
  Incident,
  IncidentCatalog,
  IncidentSummary,
  KretResult,
  LessonsResult,
  LogEntry,
  MessageCheckResult,
  Organization,
  SafeguardState,
} from './types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const OFFLINE_MESSAGE = 'Brak połączenia z serwerem CyberKret. Sprawdź, czy backend działa.'
const GENERIC_MESSAGE = 'Coś poszło nie tak. Spróbuj ponownie.'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0)
  }
  if (!response.ok) {
    let message = response.status >= 500 ? OFFLINE_MESSAGE : GENERIC_MESSAGE
    const body: unknown = await response.json().catch(() => null)
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
      message = body.detail
    }
    throw new ApiError(message, response.status)
  }
  return (await response.json()) as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/health'),
  log: (limit = 30) => request<LogEntry[]>(`/log?limit=${limit}`),
  resetDemo: () => post<Organization>('/demo/reset'),
  org: () => request<Organization>('/org'),
  setSafeguard: (id: string, state: SafeguardState) =>
    patch<Organization>(`/org/safeguards/${encodeURIComponent(id)}`, { state, source: 'answers' }),
  runKret: () => post<KretResult>('/kret/run'),
  latestKret: () => request<KretResult | null>('/kret/runs/latest'),
  checkDomain: (domain: string, consent: boolean) =>
    post<DomainCheckResponse>('/kret/domain-check', { domain, consent }),
  catalog: () => request<IncidentCatalog>('/incident-types'),
  incidents: () => request<IncidentSummary[]>('/incidents'),
  incident: (id: number) => request<Incident>(`/incidents/${id}`),
  createIncident: (type: string, answers: Record<string, string>, facts: string[]) =>
    post<Incident>('/incidents', { type, answers, facts }),
  answer: (id: number, answers: Record<string, string>) => patch<Incident>(`/incidents/${id}/answers`, { answers }),
  setAction: (id: number, actionId: string, status: ActionStatus) =>
    patch<Incident>(`/incidents/${id}/actions/${encodeURIComponent(actionId)}`, { status }),
  confirm: (id: number, itemId: string, done: boolean) =>
    patch<Incident>(`/incidents/${id}/confirmations/${encodeURIComponent(itemId)}`, { done }),
  closeIncident: (id: number) => post<Incident>(`/incidents/${id}/close`),
  applyLessons: (id: number, safeguards: string[]) =>
    post<LessonsResult>(`/incidents/${id}/lessons/apply`, { safeguards }),
  analyzeMessage: (text: string) => post<MessageCheckResult>('/analyze-message', { text }),
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : GENERIC_MESSAGE
}
