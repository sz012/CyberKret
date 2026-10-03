import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Landing from './landing/Landing'
import Dashboard from './views/Dashboard'
import IncidentView from './views/IncidentView'
import Incidents from './views/Incidents'
import Mail from './views/Mail'
import Tunnels from './views/Tunnels'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="tunele" element={<Tunnels />} />
        <Route path="poczta" element={<Mail />} />
        <Route path="incydent" element={<Incidents />} />
        <Route path="incydent/:id" element={<IncidentView />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
