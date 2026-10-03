import { Link } from 'react-router-dom'
import { Mascot } from '../components/Mascot'

export function NotFoundView() {
  return (
    <div className="page page--center">
      <Mascot mood="dig" className="not-found__mole" />
      <h1>Tu nie ma tunelu</h1>
      <p className="lead">Kret przekopał to miejsce i niczego nie znalazł.</p>
      <Link to="/" className="btn btn--lamp">
        Wróć na powierzchnię
      </Link>
    </div>
  )
}
