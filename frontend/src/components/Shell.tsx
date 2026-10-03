import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Health, Org } from '../api/types'
import { BrandMark, Wordmark } from './BrandMark'
import { Icon } from './icons'
import { useHealth } from './useHealth'

export function LocalBadge({ health }: { health: Health | null }) {
  if (!health) return <span className="pill bad"><span className="dot" />backend niedostępny</span>
  const m = health.llm
  return (
    <span className={`pill ${m.available ? 'ok' : 'warn'}`} title={m.available ? `Model ${m.model} działa na tym komputerze` : 'Ollama nie odpowiada. Kret działa na regułach i szablonach.'}>
      <span className="dot" />
      {m.available ? `${m.model} · lokalnie` : 'tryb bez modelu'} · 0 B na zewnątrz
    </span>
  )
}

export default function Shell() {
  const health = useHealth()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [org, setOrg] = useState<Org | null>(null)

  const reloadOrg = useCallback(async () => {
    setOrg(await api.org())
  }, [])

  useEffect(() => {
    api.org().then(setOrg)
  }, [])

  const reset = async () => {
    if (!confirm('Wrócić do firmy demo? Twoja firma, incydenty, maile i przejścia kreta zostaną usunięte z tego komputera.')) return
    await api.resetDemo()
    setMenu(false)
    nav('/app')
    location.reload()
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/app" className="brand" aria-label="cyberKret, pulpit">
          <BrandMark />
          <span>
            <Wordmark />
            <small>{org?.name || 'Twoja firma'}</small>
          </span>
        </Link>
        <nav className="mainnav" aria-label="Główna nawigacja">
          <NavLink to="/app" end>Pulpit</NavLink>
          <NavLink to="/app/tunele">Tunele</NavLink>
          <NavLink to="/app/poczta">Kret pocztowy</NavLink>
          <NavLink to="/app/incydent">Incydent</NavLink>
        </nav>
        <div className="topbar-right">
          <LocalBadge health={health} />
          <button className="btn btn-bad btn-sm" onClick={() => nav('/app/incydent?nowy=1')}>
            <Icon name="alert" size={16} /> Coś się stało
          </button>
          <div className="menu">
            <button className="btn btn-ghost btn-sm" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="Więcej">⋯</button>
            {menu && (
              <div className="menu-pop" role="menu">
                <Link to="/app/firma" role="menuitem" onClick={() => setMenu(false)}>Moja firma</Link>
                <Link to="/" role="menuitem">Strona projektu</Link>
                <Link to="/app/karta" role="menuitem" onClick={() => setMenu(false)}>Karta kreta do druku</Link>
                <button role="menuitem" onClick={reset}>Wróć do firmy demo</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="page">
        <Outlet context={{ org, reloadOrg }} />
      </main>
    </div>
  )
}
