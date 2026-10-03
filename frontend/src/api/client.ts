import type {
  Analysis, DomainResult, EmergencyCard, Health, Incident, IncidentRow, KretRun, KretStory, LocalCheck, MailMessage, MailRow, Org,
} from './types'

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `Błąd ${res.status}`
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') msg = j.detail
    } catch { /* not json */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => req<Health>('GET', '/api/health'),
  org: () => req<Org>('GET', '/api/org'),
  card: () => req<EmergencyCard>('GET', '/api/org/card'),
  patchSafeguard: (id: string, state: string) => req('PATCH', `/api/org/safeguards/${id}`, { state, source: 'answers' }),

  runKret: (label?: string) => req<KretRun>('POST', `/api/kret/run${label ? `?label=${encodeURIComponent(label)}` : ''}`),
  runs: () => req<KretRun[]>('GET', '/api/kret/runs'),
  story: (id: number) => req<KretStory>('GET', `/api/kret/runs/${id}/story`),
  domainCheck: (domain: string) => req<DomainResult>('POST', '/api/kret/domain-check', { domain, consent: true, apply: true }),
  localCheck: () => req<LocalCheck>('POST', '/api/kret/local-check'),
  applySafeguards: (safeguards: string[]) => req<{ applied: string[] }>('POST', '/api/kret/apply', { safeguards }),

  inbox: () => req<{ mailbox: string; owner: string; messages: MailRow[] }>('GET', '/api/mail'),
  mail: (id: string) => req<MailMessage>('GET', `/api/mail/${id}`),
  scanMail: (id: string) => req<Analysis>('POST', `/api/mail/${id}/scan`),
  deliverNext: () => req<{ id: string }>('POST', '/api/mail/deliver-next'),
  uploadEml: (eml: string) => req<{ id: string }>('POST', '/api/mail/upload', { eml }),
  analyzeText: (text: string) => req<Analysis>('POST', '/api/analyze-message', { text }),

  incidents: () => req<IncidentRow[]>('GET', '/api/incidents'),
  incident: (id: number) => req<Incident>('GET', `/api/incidents/${id}`),
  createIncident: (type: string, mail_id?: string) => req<Incident>('POST', '/api/incidents', { type, mail_id }),
  answer: (id: number, answers: Record<string, string>) => req<Incident>('PATCH', `/api/incidents/${id}/answers`, { answers }),
  actionStatus: (id: number, aid: string, status: string) => req<Incident>('PATCH', `/api/incidents/${id}/actions/${aid}`, { status }),
  confirm: (id: number, cid: string, done: boolean) => req<Incident>('PATCH', `/api/incidents/${id}/confirmations/${cid}`, { done }),
  closeIncident: (id: number) => req<Incident>('POST', `/api/incidents/${id}/close`),
  brief: (id: number) => req<{ brief: string; next: string; llm: { model: string | null; ms: number | null } }>('GET', `/api/incidents/${id}/brief`),
  incidentTypes: () => req<{ id: string; label: string; ready: boolean }[]>('GET', '/api/incidents/types'),

  resetDemo: () => req('POST', '/api/demo/reset'),
}
