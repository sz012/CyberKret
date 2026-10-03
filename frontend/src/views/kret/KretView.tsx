import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../../api/client'
import type { KretResult, SafeguardState } from '../../api/types'
import { Icon } from '../../components/Icon'
import { ErrorNote, Loading, PageHead, Panel, Pill } from '../../components/ui'
import { useAppData, useRequiredOrg } from '../../lib/appData'
import { formatTime } from '../../lib/format'
import { GroundMap } from '../../map/GroundMap'
import { summaryLines, type DigLine } from '../../map/lines'
import { DomainPanel } from './DomainPanel'
import { KnownAndUnknown, KretConsole, MapLegend, Moves, Stories } from './KretReport'
import { PasswordPanel } from './PasswordPanel'
import { SafeguardBoard } from './SafeguardBoard'

const IDLE_LINE: DigLine = { text: '> kret czeka przy wejściu. Wpuść go, żeby przekopał mapę biura.', tone: 'hi' }

export function KretView() {
  const org = useRequiredOrg()
  const { setOrg, reloadOrg } = useAppData()
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState<KretResult | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [lines, setLines] = useState<DigLine[]>([])
  const [digToken, setDigToken] = useState(0)
  const [skipToken, setSkipToken] = useState(0)
  const [digging, setDigging] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoDig = useRef(params.get('kop') === '1')

  const dig = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const fresh = await api.runKret()
      setResult(fresh)
      setLines([])
      setHighlight(null)
      setDigging(true)
      setDigToken((token) => token + 1)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    api
      .latestKret()
      .then((latest) => {
        if (!alive) return
        setResult(latest)
        setLoaded(true)
      })
      .catch((caught) => {
        if (!alive) return
        setError(errorMessage(caught))
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!loaded || !autoDig.current) return
    autoDig.current = false
    setParams({}, { replace: true })
    void dig()
  }, [loaded, dig, setParams])

  const recount = async () => {
    const fresh = await api.runKret()
    setResult(fresh)
  }

  const changeSafeguard = async (id: string, state: SafeguardState) => {
    setBusy(true)
    setError(null)
    try {
      setOrg(await api.setSafeguard(id, state))
      await recount()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const domainApplied = async () => {
    await reloadOrg()
    await recount()
  }

  if (!loaded) return <Loading />

  const consoleLines = digging ? lines : result ? summaryLines(result) : [IDLE_LINE]

  return (
    <div className="page">
      <PageHead
        depth="1,5 m"
        title="Tunele"
        lead="Kret przekopuje mapę biura i szuka dróg do tego, co cenne. Pojedyncza luka często wygląda niewinnie, groźne robi się dopiero połączenie kilku."
        actions={
          digging ? (
            <button type="button" className="btn btn--ghost" onClick={() => setSkipToken((token) => token + 1)}>
              <Icon name="skip" size={16} />
              Pomiń animację
            </button>
          ) : (
            <button type="button" className="btn btn--lamp" onClick={dig} disabled={busy}>
              <Icon name="play" size={16} />
              {result ? 'Wpuść kreta jeszcze raz' : 'Wpuść kreta'}
            </button>
          )
        }
      />
      {error && <ErrorNote message={error} />}

      <section className="ground-panel">
        <GroundMap
          result={result}
          orgName={org.name}
          digToken={digToken}
          skipToken={skipToken}
          highlight={highlight}
          onLog={(line) => setLines((previous) => [...previous, line])}
          onDigEnd={() => setDigging(false)}
        />
        <div className="ground-bar">
          <Pill tone="lamp" dot>
            {digging ? 'kret kopie' : result ? `kopał o ${formatTime(result.created_at)}` : 'jeszcze nie kopał'}
          </Pill>
          <KretConsole lines={consoleLines} />
        </div>
        <MapLegend />
      </section>

      {result && !digging && (
        <>
          <div className="columns columns--kret">
            <Panel title="Zasyp najpierw" aside="ruchy, które zamykają najwięcej dróg">
              <div className="panel-body">
                <Moves result={result} busy={busy} onDone={(safeguard) => changeSafeguard(safeguard, 'present')} />
              </div>
            </Panel>
            <Panel title="Relacja kreta" aside="symulacja">
              <Stories result={result} highlight={highlight} onHighlight={setHighlight} />
            </Panel>
          </div>
          <Panel title="Stan wiedzy kreta">
            <div className="panel-body">
              <KnownAndUnknown result={result} onSet={changeSafeguard} busy={busy} />
            </div>
          </Panel>
        </>
      )}

      <SafeguardBoard org={org} onChange={changeSafeguard} busy={busy || digging} />

      <div className="columns">
        <DomainPanel org={org} onApplied={domainApplied} />
        <PasswordPanel />
      </div>
    </div>
  )
}
