import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import KretFilm from './film/KretFilm'
import './landing.css'

export default function Landing() {
  useEffect(() => {
    document.title = 'CyberKret · Lepiej, żeby pierwszy był Twój kret'
  }, [])

  return (
    <div className="landing">
      <nav className="lnav" aria-label="CyberKret">
        <Link to="/" className="brand">
          <BrandMark size={40} />
          <b>CyberKret</b>
        </Link>
        <Link className="lnav-app" to="/app">Otwórz aplikację</Link>
      </nav>
      <KretFilm />
    </div>
  )
}
