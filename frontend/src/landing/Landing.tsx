import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/BrandMark'
import KretFilm from './film/KretFilm'
import './landing.css'

export default function Landing() {
  useEffect(() => {
    document.title = 'cyberKret · Lepiej, żeby pierwszy był Twój kret'
  }, [])

  return (
    <div className="landing">
      <nav className="lnav" aria-label="cyberKret">
        <Link to="/" className="brand" aria-label="cyberKret, strona główna">
          <BrandMark size={34} />
          <Wordmark />
        </Link>
        <div className="lnav-links">
          <Link className="lnav-app lnav-demo" to="/demo">Zobacz demo</Link>
          <Link className="lnav-app" to="/app">Otwórz aplikację</Link>
        </div>
      </nav>
      <KretFilm />
    </div>
  )
}
