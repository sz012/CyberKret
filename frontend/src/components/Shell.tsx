import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Health, Org } from '../api/types'
import { Wordmark } from './BrandMark'
import { Icon } from './icons'
import { useHealth } from './useHealth'

export function LocalBadge({ health }: { health: Health | null }) {
  if (!health) return <span className="pill bad"><span className="dot" />backend unavailable</span>
  const m = health.llm
  return (
    <span className={`pill ${m.available ? 'ok' : 'warn'}`} title={m.available ? `Model ${m.model} runs on this computer` : 'Ollama is not responding. The mole runs on rules and templates.'}>
      <span className="dot" />
      {m.available ? `${m.model} · local` : 'no-model mode'} · 0 B sent out
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
    if (!confirm('Go back to the demo company? Your company, incidents, emails and mole runs will be removed from this computer.')) return
    await api.resetDemo()
    setMenu(false)
    nav('/app')
    location.reload()
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/app" className="brand" aria-label="cyberMole, dashboard">
          <span>
            <Wordmark />
            <small>{org?.name || 'Your company'}</small>
          </span>
        </Link>
        <nav className="mainnav" aria-label="Main navigation">
          <NavLink to="/app" end>Dashboard</NavLink>
          <NavLink to="/app/tunnels">Tunnels</NavLink>
          <NavLink to="/app/mail">Mail mole</NavLink>
          <NavLink to="/app/incident">Incident</NavLink>
        </nav>
        <div className="topbar-right">
          <LocalBadge health={health} />
          <button className="btn btn-bad btn-sm" onClick={() => nav('/app/incident?new=1')}>
            <Icon name="alert" size={16} /> Something happened
          </button>
          <div className="menu">
            <button className="btn btn-ghost btn-sm" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="More">⋯</button>
            {menu && (
              <div className="menu-pop" role="menu">
                <Link to="/app/company" role="menuitem" onClick={() => setMenu(false)}>My company</Link>
                <Link to="/" role="menuitem">Project page</Link>
                <Link to="/app/card" role="menuitem" onClick={() => setMenu(false)}>Printable mole card</Link>
                <button role="menuitem" onClick={reset}>Back to the demo company</button>
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
