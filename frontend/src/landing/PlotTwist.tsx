import { useCallback, useEffect, useRef, useState } from 'react'
import { MoleGlyph } from '../components/Mascot'

/*
 * Opening scene, about 12 seconds:
 * 1 night  – empty office, cables idle under the floor
 * 2 motion – something travels inside a network cable, the monitor wakes up
 * 3 alarm  – red alert: "someone is in your network?"
 * 4 reveal – the floor port opens, our mole climbs out with the headlamp on
 * 5 twist  – "Relax. It's your mole." and the call to action
 */

type Act = 1 | 2 | 3 | 4 | 5
const SCHEDULE: [Act, number][] = [[1, 0], [2, 2400], [3, 5600], [4, 7800], [5, 10200]]

const CAPTIONS: Record<Act, { kicker: string; line: string }> = {
  1: { kicker: '23:47 · Kancelaria Nowak', line: 'Wszyscy poszli do domu.' },
  2: { kicker: 'pod podłogą', line: 'Coś porusza się w kablach.' },
  3: { kicker: 'alarm', line: 'Ktoś jest w Twojej sieci?' },
  4: { kicker: '', line: 'Spokojnie.' },
  5: { kicker: '', line: 'To Twój kret.' },
}

const FLOOR = 470
const PORT_X = 820
const CABLE = `M-20 560 C 200 560, 260 600, 420 600 S 640 540, 720 560 S ${PORT_X} 600, ${PORT_X} ${FLOOR + 6}`

export default function PlotTwist({ onDone }: { onDone?: () => void }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [act, setAct] = useState<Act>(reduce ? 5 : 1)
  const [run, setRun] = useState(0)
  // Portrait screens crop the scene around the floor port so the mole stays in frame.
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-aspect-ratio: 1/1)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-aspect-ratio: 1/1)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const timers = useRef<number[]>([])
  const blip = useRef<SVGGElement>(null)
  const cable = useRef<SVGPathElement>(null)

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const play = useCallback(() => {
    clear()
    setAct(1)
    setRun((r) => r + 1)
    for (const [a, t] of SCHEDULE) timers.current.push(window.setTimeout(() => setAct(a), t))
  }, [])

  useEffect(() => {
    if (!reduce) play()
    return clear
  }, [play, reduce])

  useEffect(() => {
    if (act === 5) onDone?.()
  }, [act, onDone])

  // The glowing lump travelling inside the cable during acts 2–3.
  useEffect(() => {
    if (act !== 2 || !cable.current || !blip.current) return
    const path = cable.current
    const L = path.getTotalLength()
    let raf = 0
    let t0: number | null = null
    const dur = 5000
    const step = (now: number) => {
      if (t0 === null) t0 = now
      const k = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - k, 1.6)
      const p = path.getPointAtLength(e * L)
      blip.current?.setAttribute('transform', `translate(${p.x} ${p.y})`)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [act, run])

  const skip = () => {
    clear()
    setAct(5)
  }

  const cap = CAPTIONS[act]
  return (
    <section className={`twist act-${act}`} aria-label="Animacja: nocą w biurze coś rusza się w kablach. To kret CyberKret.">
      <svg className="twist-svg" viewBox={narrow ? '520 0 680 700' : '0 0 1200 700'} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="tw-room" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0c0e12" />
            <stop offset="1" stopColor="#14171d" />
          </linearGradient>
          <radialGradient id="tw-lamp" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd479" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tw-blip" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff3cf" />
            <stop offset="0.35" stopColor="#ffd479" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffd479" stopOpacity="0" />
          </radialGradient>
          <clipPath id="tw-above">
            <rect x="0" y="0" width="1200" height={FLOOR + 2} />
          </clipPath>
          <pattern id="tw-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="#161a20" />
          </pattern>
        </defs>

        {/* room */}
        <rect width="1200" height={FLOOR} fill="url(#tw-room)" />
        <g className="tw-window" transform="translate(760 0)">
          <rect x="140" y="90" width="300" height="220" rx="6" fill="#0f141c" stroke="#262b34" strokeWidth="6" />
          <path d="M290 90v220M140 200h300" stroke="#262b34" strokeWidth="5" />
          <circle cx="380" cy="140" r="22" fill="#e9e3cf" opacity=".8" />
          <circle cx="372" cy="134" r="22" fill="#0f141c" />
          <g fill="#1e2530">
            <rect x="150" y="250" width="40" height="55" /><rect x="196" y="230" width="30" height="75" /><rect x="232" y="262" width="50" height="43" />
            <rect x="300" y="240" width="34" height="65" /><rect x="340" y="258" width="44" height="47" /><rect x="390" y="236" width="44" height="69" />
          </g>
          <g fill="#ffd479" opacity=".35">
            <rect x="158" y="262" width="5" height="5" /><rect x="204" y="246" width="5" height="5" /><rect x="310" y="252" width="5" height="5" /><rect x="400" y="250" width="5" height="5" />
          </g>
        </g>
        <text x="600" y="70" textAnchor="middle" className="tw-sign">KANCELARIA NOWAK</text>

        {/* desk + monitor */}
        <g className="tw-desk">
          <rect x="560" y="360" width="300" height="12" rx="3" fill="#232831" />
          <rect x="574" y="372" width="10" height={FLOOR - 372} fill="#232831" />
          <rect x="836" y="372" width="10" height={FLOOR - 372} fill="#232831" />
          <rect x="640" y="262" width="140" height="92" rx="6" fill="#1a1e25" stroke="#323844" strokeWidth="3" />
          <rect className="tw-screen" x="648" y="270" width="124" height="76" rx="3" />
          <g className="tw-screen-alert">
            <path d="M710 286 l12 22 h-24 z" fill="none" stroke="#ff6159" strokeWidth="3" strokeLinejoin="round" />
            <path d="M710 294 v6 M710 304 v.5" stroke="#ff6159" strokeWidth="3" strokeLinecap="round" />
            <text x="710" y="330" textAnchor="middle" className="tw-screen-text">RUCH W SIECI</text>
          </g>
          <g className="tw-screen-ok">
            <path d="M694 300 l10 10 l20 -22" fill="none" stroke="#5fd08a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="710" y="330" textAnchor="middle" className="tw-screen-text ok">KRET SPRAWDZA</text>
          </g>
          <rect x="700" y="354" width="20" height="8" fill="#323844" />
          <rect x="600" y="350" width="34" height="10" rx="2" fill="#2a2f39" />
        </g>
        <g className="tw-plant" transform="translate(-520 0)">
          <rect x="960" y="410" width="50" height="60" rx="6" fill="#2a2f39" />
          <path d="M985 410 C 960 360, 940 360, 930 340 M985 410 C 990 350, 1000 330, 1010 310 M985 410 C 1010 380, 1040 370, 1050 350" stroke="#2f5a3d" strokeWidth="8" strokeLinecap="round" fill="none" />
        </g>

        {/* floor + port */}
        <rect y={FLOOR} width="1200" height={700 - FLOOR} fill="#0b0d10" />
        <rect y={FLOOR} width="1200" height={700 - FLOOR} fill="url(#tw-grid)" />
        <rect y={FLOOR - 6} width="1200" height="12" fill="#262b34" />
        {Array.from({ length: 25 }, (_, i) => <rect key={i} x={i * 48 + 1} y={FLOOR - 5} width="46" height="10" rx="1" fill="#2f3542" />)}

        {/* cables under the floor */}
        <g className="tw-cables">
          <path d="M-20 520 C 300 520, 500 540, 1220 515" className="tw-cable" />
          <path d="M-20 640 C 300 650, 800 620, 1220 650" className="tw-cable" />
          <path ref={cable} d={CABLE} className="tw-cable main" />
          <path d={CABLE} className="tw-cable-glow" />
        </g>
        <g ref={blip} className="tw-blip" transform="translate(-40 560)">
          <circle r="34" fill="url(#tw-blip)" />
          <circle r="7" fill="#fff6dc" />
        </g>

        {/* floor port */}
        <g className="tw-port" transform={`translate(${PORT_X} ${FLOOR})`}>
          <rect x="-46" y="-4" width="92" height="10" rx="2" fill="#0b0d10" />
          <g className="tw-lid">
            <rect x="-48" y="-8" width="96" height="10" rx="3" fill="#3a414f" />
            <rect x="-14" y="-6" width="28" height="4" rx="2" fill="#5b6271" />
          </g>
        </g>

        {/* mole rising from the port */}
        <g clipPath="url(#tw-above)">
          <g className="tw-mole-wrap">
            <g transform={`translate(${PORT_X - 120} ${FLOOR - 188 * 1.05}) scale(1.05)`}>
              <MoleGlyph pose={act >= 5 ? 'happy' : 'check'} beam={act >= 4} lamp={act >= 4} />
            </g>
          </g>
        </g>
        <circle className="tw-lampglow" cx={PORT_X + 40} cy={FLOOR - 140} r="260" fill="url(#tw-lamp)" />

        <rect className="tw-alarm" width="1200" height="700" />
      </svg>

      <div className="twist-copy">
        <div className="twist-caption" key={`${act}-${run}`}>
          {cap.kicker && <span className="eyebrow">{cap.kicker}</span>}
          <h1>{act >= 4 ? (
            <>Spokojnie.<br /><em>{act >= 5 ? 'To Twój kret.' : ' '}</em></>
          ) : cap.line}</h1>
          {act >= 5 && (
            <div className="twist-cta">
              <p>Sprawdza, którędy wszedłby ten prawdziwy. Zanim on to zrobi.</p>
              <div className="row gap wrap">
                <a className="btn btn-lamp btn-lg" href="/app">Zobacz demo ▸</a>
                <a className="btn btn-ghost btn-lg" href="#jak">Jak to działa</a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="twist-controls">
        {act < 5 ? (
          <button className="btn btn-ghost btn-sm" onClick={skip}>Pomiń ▸▸</button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={play}>↺ Jeszcze raz</button>
        )}
      </div>
    </section>
  )
}
