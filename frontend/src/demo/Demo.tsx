import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '../components/BrandMark'
import { Icon } from '../components/icons'
import DemoScenes, { type Presentation } from './DemoScenes'
import { timeLabel } from './timeline'
import { useDemoPlayer } from './useDemoPlayer'
import '../landing/landing.css'
import './demo.css'

export default function Demo() {
  const [data, setData] = useState<Presentation | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [started, setStarted] = useState(false)
  const [clean, setClean] = useState(false)
  const [settings, setSettings] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const player = useDemoPlayer()
  const { time, playing, setPlaying, duration, timeline, index, shot, seek, toggle, voices, error, setError, loadVoices, loadingVoice } = player

  useEffect(() => {
    document.title = 'cyberMole · Demo'
    const controller = new AbortController()
    fetch('/api/demo/presentation', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json() })
      .then(setData)
      .catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (!countdown) return
    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        setStarted(true)
        setPlaying(true)
      }
      setCountdown(countdown - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown, setPlaying])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { setClean(false); setCountdown(0); return }
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(event.target.tagName)) return
      if (!data || !started || countdown) return
      if (event.code === 'Space') { event.preventDefault(); toggle() }
      if (event.code === 'ArrowRight') { event.preventDefault(); seek(time + 5) }
      if (event.code === 'ArrowLeft') { event.preventDefault(); seek(time - 5) }
      if (event.code === 'Home') { event.preventDefault(); seek(0) }
      if (event.code === 'KeyH') setClean((value) => !value)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data, started, countdown, toggle, seek, time])

  const fullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen()
      else setError('This browser does not offer full screen. Open the demo in Chrome or Safari.')
    } catch {
      setError('Could not enter full screen. Use the full screen option of your browser.')
    }
  }

  const startRecording = () => {
    seek(0)
    setPlaying(false)
    setSettings(false)
    setClean(true)
    setCountdown(3)
  }

  return (
    <div ref={root} className={`demo ${clean ? 'demo-clean' : ''} ${playing ? 'demo-playing' : 'demo-paused'}`}>
      <header className="demo-header">
        <Link to="/" className="brand" aria-label="cyberMole, home"><Wordmark /></Link>
        <span className="demo-header-context">{started ? shot.label : 'The story of one company'}</span>
        <span className="demo-fiction">Example: a fictional company</span>
      </header>

      <main className="demo-stage" aria-label="cyberMole presentation">
        {!started || !data ? (
          <div className="demo-poster">
            <div className="demo-poster-cables" aria-hidden="true"><span /><span /><span /><i /></div>
            <div className="demo-poster-copy">
              <p>cyberMole in action</p>
              <h1>Before a small mistake<br />turns into<br /><em>a big problem.</em></h1>
              <p>One law office. One suspicious invoice.<br />And a mole that knows where to look.</p>
              <button className="btn btn-lamp btn-lg" disabled={!data || Boolean(countdown)} onClick={() => { setStarted(true); toggle() }}>
                <span aria-hidden="true">▶</span> {data ? `Watch the demo · ${timeLabel(duration)}` : loadError ? 'Demo unavailable' : 'Preparing the presentation…'}
              </button>
              {loadError && <div role="alert" className="demo-load-error"><p>Cannot load the scenario. Check that the backend is running.</p><button className="btn btn-ghost" onClick={() => { setLoadError(false); setAttempt((value) => value + 1) }}>Try again</button></div>}
              <small>Results of the app's rules on sample data.</small>
            </div>
          </div>
        ) : <DemoScenes id={shot.id} progress={Math.min(1, (time - shot.start) / shot.duration)} data={data} />}
      </main>

      {countdown > 0 && <div className="demo-countdown" role="status"><b>{countdown}</b><span>Starting in a moment</span></div>}

      <div className="demo-controls">
        <div className="demo-progress"><input aria-label="Presentation position" type="range" min="0" max={duration} step="0.1" value={time} disabled={!data || Boolean(countdown)} onChange={(event) => { setStarted(true); seek(Number(event.target.value)) }} style={{ '--progress': `${100 * time / duration}%` } as React.CSSProperties} /></div>
        <div className="demo-transport">
          <button className="demo-control demo-play" disabled={!data || Boolean(countdown) || loadingVoice} aria-label={playing ? 'Pause' : time >= duration ? 'Play from the start' : 'Play'} onClick={() => { setStarted(true); toggle() }}>{playing ? 'Ⅱ' : '▶'}</button>
          <span className="demo-time">{timeLabel(time)} <span>/ {timeLabel(duration)}</span></span>
          <nav className="demo-chapters" aria-label="Presentation scenes">
            {timeline.map((scene, i) => <button key={scene.id} aria-label={`${i + 1}. ${scene.label}`} aria-current={index === i ? 'step' : undefined} disabled={!data || Boolean(countdown)} onClick={() => { setStarted(true); seek(scene.start) }}><span>0{i + 1}</span><span>{scene.label}</span></button>)}
          </nav>
          <button className="demo-control" aria-expanded={settings} onClick={() => setSettings((value) => !value)}><Icon name="upload" size={17} /><span>Narration and recording</span></button>
          <button className="demo-control demo-fullscreen" aria-label="Full screen" onClick={fullScreen}>⛶</button>
        </div>
      </div>

      {settings && !clean && <section className="demo-settings" aria-label="Recording settings">
        <div className="demo-settings-heading"><h2>Prepare a recording</h2><button className="demo-control" aria-label="Close settings" onClick={() => setSettings(false)}>×</button></div>
        <p>Load narration clips for the scenes you want. Each scene waits until its clip ends.</p>
        <label className="btn btn-ghost demo-audio-upload"><Icon name="upload" size={18} />{loadingVoice ? 'Loading…' : 'Load MP3 or WAV'}<input type="file" multiple accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,.mp3,.wav,.m4a" disabled={loadingVoice} onChange={(event) => { void loadVoices(event.target.files); event.target.value = '' }} /></label>
        <ol>{timeline.map((scene, i) => <li key={scene.id}><span>0{i + 1} · {scene.label}</span><span className={voices[i] ? 'ok' : 'muted'}>{voices[i] ? voices[i].name : i === 0 ? 'no narration' : 'no recording'}</span></li>)}</ol>
        <p className="small muted">File names: 02-company.mp3, 03-tunnels.mp3, 04-move.mp3, 05-mail.mp3, 06-plan.mp3, 07-final.mp3. The files stay in this browser until the page is reloaded.</p>
        <button className="btn btn-lamp" disabled={!data || loadingVoice} onClick={startRecording}>Hide the panel and play in 3 s</button>
        <p className="small muted">Start your screen recorder separately. Esc shows the panel. Space pauses. Arrow keys skip 5 s.</p>
      </section>}

      {clean && !playing && !countdown && <button className="demo-show-controls" onClick={() => setClean(false)}>Show controls</button>}
      {error && <div className="demo-error" role="alert"><span>{error}</span><button aria-label="Close message" onClick={() => setError('')}>×</button></div>}
    </div>
  )
}
