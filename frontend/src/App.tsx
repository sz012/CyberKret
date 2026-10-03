import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { IncidentNewView } from './views/incident/IncidentNewView'
import { IncidentsView } from './views/incident/IncidentsView'
import { IncidentView } from './views/incident/IncidentView'
import { KretView } from './views/kret/KretView'
import { MessageCheckView } from './views/MessageCheckView'
import { NotFoundView } from './views/NotFoundView'
import { StartView } from './views/StartView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<StartView />} />
          <Route path="kret" element={<KretView />} />
          <Route path="poczta" element={<MessageCheckView />} />
          <Route path="incydenty" element={<IncidentsView />} />
          <Route path="incydenty/nowy" element={<IncidentNewView />} />
          <Route path="incydenty/:id" element={<IncidentView />} />
          <Route path="incydenty/:id/:tab" element={<IncidentView />} />
          <Route path="*" element={<NotFoundView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
