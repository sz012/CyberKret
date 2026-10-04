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
      <Route path="/demo" element={<Suspense fallback={<div className="page" role="status">Przygotowuję demo…</div>}><Demo /></Suspense>} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="tunele" element={<Tunnels />} />
        <Route path="poczta" element={<Mail />} />
        <Route path="incydent" element={<Incidents />} />
        <Route path="incydent/:id" element={<IncidentView />} />
        <Route path="karta" element={<EmergencyCard />} />
        <Route path="firma" element={<Company />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
