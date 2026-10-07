import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { span, wave } from './geometry'
import { Network } from './Network'
import { Blip, Probe, ScanBeam } from './Probe'
import { Clock, Monitor, Motes, Port, PortLight, Room, RouterLeds, Tags, UnderCables } from './Room'
import { AMBIENT, END, FLOOR, T, alarmLevel, camera, probeState } from './timeline'

const CAPTIONS: { key: string; from: number; to: number }[] = [
  { key: 'night', from: 250, to: 1900 },
  { key: 'motion', from: 1900, to: 5000 },
  { key: 'alarm', from: 5000, to: 7300 },
  { key: 'calm', from: 7300, to: 10700 },
  { key: 'purpose', from: 11900, to: Infinity },
]

function Defs() {
  return (
    <defs>
      <linearGradient id="kf-wall" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#06080a" />
        <stop offset="0.7" stopColor="#0c0f13" />
        <stop offset="1" stopColor="#101318" />
      </linearGradient>
      <linearGradient id="kf-sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#0a1019" />
        <stop offset="1" stopColor="#131d2c" />
      </linearGradient>
      <linearGradient id="kf-shaft-cold" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#eef3ff" stopOpacity="0.8" />
        <stop offset="0.55" stopColor="#c9d6ff" stopOpacity="0.1" />
        <stop offset="1" stopColor="#c9d6ff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="kf-shaft-warm" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.8" />
        <stop offset="0.55" stopColor="#ffd479" stopOpacity="0.1" />
        <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="kf-port-cold" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#eef3ff" stopOpacity="0.9" />
        <stop offset="1" stopColor="#eef3ff" stopOpacity="0.1" />
      </linearGradient>
      <linearGradient id="kf-port-warm" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffe7ad" stopOpacity="0.1" />
      </linearGradient>
      <linearGradient id="kf-cone" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#ffd479" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="kf-glow-cold">
        <stop offset="0" stopColor="#e3ebff" stopOpacity="0.55" />
        <stop offset="0.3" stopColor="#a9bdf0" stopOpacity="0.16" />
        <stop offset="1" stopColor="#a9bdf0" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kf-glow-warm">
        <stop offset="0" stopColor="#ffe7ad" stopOpacity="0.6" />
        <stop offset="0.3" stopColor="#ffd479" stopOpacity="0.17" />
        <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kf-glow-red">
        <stop offset="0" stopColor="#ff8a83" stopOpacity="0.7" />
        <stop offset="1" stopColor="#ff6159" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kf-room" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd479" stopOpacity="0.16" />
        <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="kf-vignette" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.72" />
      </radialGradient>
      <pattern id="kf-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="1.2" height="7" fill="#1a1f27" />
      </pattern>
      <pattern id="kf-dots" width="36" height="36" patternUnits="userSpaceOnUse">
        <circle cx="18" cy="18" r="1" fill="#141921" />
      </pattern>
      <clipPath id="kf-above">
        <rect x="-1600" y="-1600" width="4400" height={1600 + FLOOR - 6} />
      </clipPath>
    </defs>
  )
}

export default function KretFilm({ time, presentation = false }: { time?: number; presentation?: boolean }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [elapsed, setT] = useState(reduce ? END : 0)
  const controlled = time !== undefined
  const t = controlled ? Math.min(END, time) : elapsed
  const [aspect, setAspect] = useState(16 / 9)
  const raf = useRef(0)
  const stage = useRef<HTMLElement>(null)

  const play = useCallback(() => {
    cancelAnimationFrame(raf.current)
    const started = performance.now()
    const tick = (now: number) => {
      const value = Math.min(END, now - started)
      setT(value)
      if (value < END) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (!reduce && !controlled) play()
    return () => cancelAnimationFrame(raf.current)
  }, [play, reduce, controlled])

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setAspect(width / height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const skip = () => {
    cancelAnimationFrame(raf.current)
    setT(END)
  }

  const alarm = alarmLevel(t)
  const [vx, vy, vw, vh] = camera(t, aspect)
  const shakeX = alarm * 1.2 * Math.sin(t / 37)
  const shakeY = alarm * 0.9 * Math.cos(t / 29)
  const probe = probeState(t)
  const roomGlow = probe.visible ? span(t, T.lid, T.lid + 500) * (0.35 + 0.65 * probe.warm) : 0
  const ambient = 1 - span(t, T.blip[0], T.blip[0] + 600)
  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to)
  const clock = `23:47:${String(T.clockSeconds + Math.floor(t / 1000)).padStart(2, '0')}`
  const ended = t >= END

  return (
    <section ref={stage} className="kf" aria-label="Animation: at night something moves through the office cables. It is your own mole, which checks the network and shows the path an intruder would take.">
      <svg className="kf-svg" viewBox={`${vx + shakeX} ${vy + shakeY} ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <Defs />
        <Room />
        <UnderCables t={t} />
        <Clock t={t} />
        <RouterLeds t={t} alarm={alarm} />
        <Monitor t={t} />

        {ambient > 0.01 &&
          AMBIENT.map((cable, i) =>
            [0.12, 0.45, 0.78].map((offset) => {
              const p = cable.at((offset + t / (26000 + i * 7000)) % 1)
              return <circle key={`${i}-${offset}`} cx={p.x} cy={p.y} r="2.2" fill="#6ea8ff" opacity={0.45 * ambient} />
            }),
          )}
        <Blip t={t} />

        <Network t={t} />

        <PortLight t={t} warm={probe.warm} />
        {roomGlow > 0 && <circle className="kf-glow" cx={probe.p.x} cy={probe.p.y} r="520" fill="url(#kf-room)" opacity={roomGlow} />}
        <g clipPath="url(#kf-above)">
          <ScanBeam t={t} from={probe.p} />
        </g>
        <Tags t={t} />
        <g clipPath="url(#kf-above)">
          {probe.visible && <Probe p={probe.p} warm={probe.warm} bright={probe.bright} spin={probe.spin} ring={probe.ring} speed={probe.speed} alarm={alarm} />}
        </g>
        <Port t={t} alarm={alarm} warm={probe.warm} />
        <Motes t={t} />

        {alarm > 0 && <rect x={vx - 50} y={vy - 50} width={vw + 100} height={vh + 100} fill="#ff4d42" opacity={alarm * (0.04 + 0.08 * wave(t, 900))} />}
        <rect x={vx - 50} y={vy - 50} width={vw + 100} height={vh + 100} fill="url(#kf-vignette)" pointerEvents="none" />
      </svg>

      <div className={`kf-copy${caption?.key === 'purpose' ? ' lower' : ''}`}>
        {caption?.key === 'night' && (
          <div className="kf-caption" key="night">
            <p className="kf-kicker">
              {clock} · Nowak Law Office
            </p>
            <h1>The office is empty.</h1>
          </div>
        )}
        {caption?.key === 'motion' && (
          <div className="kf-caption" key="motion">
            <h1>Something is moving in the&nbsp;cables.</h1>
          </div>
        )}
        {caption?.key === 'alarm' && (
          <div className="kf-caption alarm" key="alarm">
            <h1>Is someone in your&nbsp;network?</h1>
          </div>
        )}
        {caption?.key === 'calm' && (
          <div className="kf-caption" key="calm">
            <h1>
              Relax.
              {t >= T.ident && <span className="kf-accent">It&apos;s your&nbsp;mole.</span>}
            </h1>
          </div>
        )}
        {caption?.key === 'purpose' && (
          <div className="kf-caption" key="purpose">
            <h1>Find the way in before an attacker&nbsp;does.</h1>
            {t >= T.sub && <p className="kf-sub">The mole shows the path to your data and tells you what to close&nbsp;first.</p>}
            {t >= T.cta && !presentation && (
              <div className="kf-cta">
                <Link className="btn btn-lamp btn-lg" to="/app">Open the app</Link>
                <button type="button" className="kf-link" onClick={play}>Watch again</button>
              </div>
            )}
            {t >= T.cta && !presentation && <p className="kf-pillars">attack simulation · incident support · local&nbsp;AI</p>}
          </div>
        )}
      </div>

      {!ended && !presentation && (
        <button type="button" className="kf-skip" onClick={skip}>
          Skip
        </button>
      )}
    </section>
  )
}
