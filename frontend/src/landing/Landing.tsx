import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '../components/BrandMark'
import KretFilm from './film/KretFilm'
import './landing.css'

export default function Landing() {
  useEffect(() => {
    document.title = 'cyberMole · Better your own mole gets in first'
  }, [])

  return (
    <div className="landing">
      <nav className="lnav" aria-label="cyberMole">
        <Link to="/" className="brand" aria-label="cyberMole, home">
          <Wordmark />
        </Link>
        <div className="lnav-links">
          <Link className="lnav-app lnav-demo" to="/demo">Watch the demo</Link>
          <Link className="lnav-app" to="/app">Open the app</Link>
        </div>
      </nav>
      <KretFilm />
    </div>
  )
}
