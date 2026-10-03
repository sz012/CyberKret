export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'przed chwilą'
  if (s < 3600) return `${Math.floor(s / 60)} min temu`
  if (s < 86400) return `${Math.floor(s / 3600)} h temu`
  return new Date(iso).toLocaleDateString('pl-PL')
}

export function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = s % 60
  return [h, m, x].map((v) => String(v).padStart(2, '0')).join(':')
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few
  return many
}
