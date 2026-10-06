import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Landing from './landing/Landing'
import Company from './views/Company'
import Dashboard from './views/Dashboard'
import EmergencyCard from './views/EmergencyCard'
import IncidentView from './views/IncidentView'
import Incidents from './views/Incidents'
import Mail from './views/Mail'
import Tunnels from './views/Tunnels'

const Demo = lazy(() => import('./demo/Demo'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/demo" element={<Suspense fallback={<div className="page" role="status">Preparing the demo…</div>}><Demo /></Suspense>} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="tunnels" element={<Tunnels />} />
        <Route path="mail" element={<Mail />} />
        <Route path="incident" element={<Incidents />} />
        <Route path="incident/:id" element={<IncidentView />} />
        <Route path="card" element={<EmergencyCard />} />
        <Route path="company" element={<Company />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
