import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { api, errorMessage } from '../api/client'
import type { Health, Organization } from '../api/types'
import { AppDataContext } from '../lib/appData'
import { Icon } from './Icon'
import { BrandMark, Mascot } from './Mascot'
import { ErrorNote, Loading } from './ui'

const NAV = [
  { to: '/', depth: '0 m', title: 'Powierzchnia', hint: 'panel biura', end: true },
  { to: '/kret', depth: '1,5 m', title: 'Tunele', hint: 'mapa i kret', end: false },
  { to: '/poczta', depth: '3 m', title: 'Kret pocztowy', hint: 'podejrzana wiadomość', end: false },
  { to: '/incydenty', depth: '5 m', title: 'Incydenty', hint: 'plan i ciągłość', end: false },
]

function activeIndex(pathname: string): number {
  if (pathname.startsWith('/incydenty')) return 3
  if (pathname.startsWith('/poczta')) return 2
  if (pathname.startsWith('/kret')) return 1
  return 0
}

function shortModel(model: string): string {
  return model.split('/').pop()?.split(':')[0] ?? model
}

function ModelStatus({ health }: { health: Health | null }) {
  const available = health?.llm.available ?? false
  return (
    <div className="model-status">
      <span className={`status-dot status-dot--${available ? 'ok' : 'warn'}`} aria-hidden="true" />
      <div>
        <strong>{available ? 'Model lokalny działa' : 'Model lokalny wyłączony'}</strong>
        <span>{health ? shortModel(health.llm.model) : 'brak połączenia z serwerem'}</span>
        <span>{available ? 'Dane zostają na tym komputerze.' : 'Analiza działa na regułach.'}</span>
      </div>
    </div>
  )
}

export function AppShell() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { pathname } = useLocation()

  const reloadOrg = useCallback(async () => {
    try {
      setOrg(await api.org())
      setError(null)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [])

  useEffect(() => {
    let alive = true
    api.org().then(
      (value) => alive && setOrg(value),
      (caught: unknown) => alive && setError(errorMessage(caught)),
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    const check = () => {
      api
        .health()
        .then((value) => alive && setHealth(value))
        .catch(() => alive && setHealth(null))
    }
    check()
    const timer = setInterval(check, 30000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const value = useMemo(() => ({ org, health, setOrg, reloadOrg }), [org, health, reloadOrg])
  const index = activeIndex(pathname)

  return (
    <AppDataContext.Provider value={value}>
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <div className="app">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <BrandMark className="brand__mark" />
            CyberKret
          </Link>
          {org && <p className="sidebar__org">{org.name}</p>}
          <nav className="shaft" aria-label="Główna nawigacja" style={{ '--active': index } as CSSProperties}>
            <span className="shaft__line" aria-hidden="true" />
            <span className="shaft__mole" aria-hidden="true">
              <Mascot beam={false} />
            </span>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="shaft__item">
                <span className="shaft__depth">{item.depth}</span>
                <span className="shaft__title">{item.title}</span>
                <span className="shaft__hint">{item.hint}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar__foot">
            <Link to="/incydenty/nowy" className="btn btn--sos">
              <Icon name="siren" size={20} />
              Coś się stało
            </Link>
            <ModelStatus health={health} />
          </div>
        </aside>

        <header className="topbar">
          <div className="topbar__row">
            <Link to="/" className="brand">
              <BrandMark className="brand__mark" />
              CyberKret
            </Link>
            <Link to="/incydenty/nowy" className="btn btn--sos btn--small">
              <Icon name="siren" size={16} />
              Coś się stało
            </Link>
          </div>
          <nav className="topbar__nav" aria-label="Główna nawigacja">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <span className="shaft__depth">{item.depth}</span>
                {item.title}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="main" id="main">
          {!org ? error ? <ErrorNote message={error} onRetry={reloadOrg} /> : <Loading /> : <Outlet />}
        </main>
      </div>
    </AppDataContext.Provider>
  )
}
