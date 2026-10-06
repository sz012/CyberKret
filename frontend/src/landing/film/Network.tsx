import { IconG } from '../../components/icons'
import { bump, ease, legProgress, span, wave } from './geometry'
import { Probe } from './Probe'
import { ARRIVALS, CABLES, INTERNET, LEGS, NODES, ROUTE, SWITCH, T, TARGET, TUNNEL, type Status } from './timeline'

const STATUS_COLOR: Record<Status, string> = { ok: '#5fd08a', warn: '#f2c14e', bad: '#ff6159' }

export function Network({ t }: { t: number }) {
  const shown = span(t, T.net[0], T.net[1])
  if (shown <= 0) return null
  const drawn = span(t, T.tunnel[0], T.tunnel[1], ease.inOut)
  const hit = t >= T.tunnel[1]
  const head = TUNNEL.at(drawn)
  return (
    <g opacity={shown}>
      <g fill="none" strokeLinecap="round">
        {CABLES.map((cable, i) => (
          <g key={i}>
            <path d={cable.d} stroke="#121923" strokeWidth="9" />
            <path d={cable.d} stroke="#26364d" strokeWidth="1.8" />
          </g>
        ))}
      </g>

      {drawn > 0 && (
        <g fill="none" strokeLinecap="round">
          <path d={TUNNEL.d} stroke="#ff6159" strokeWidth="12" opacity="0.14" strokeDasharray={TUNNEL.length} strokeDashoffset={TUNNEL.length * (1 - drawn)} />
          <path d={TUNNEL.d} stroke="#ff6159" strokeWidth="2.6" strokeDasharray={TUNNEL.length} strokeDashoffset={TUNNEL.length * (1 - drawn)} />
          {hit && <path d={TUNNEL.d} stroke="#ffd2cf" strokeWidth="1.6" strokeDasharray="3 15" strokeDashoffset={-t / 30} />}
          {!hit && (
            <g className="kf-glow">
              <circle cx={head.x} cy={head.y} r="40" fill="url(#kf-glow-red)" />
              <circle cx={head.x} cy={head.y} r="4" fill="#ffe1de" stroke="none" />
            </g>
          )}
        </g>
      )}

      <Scout t={t} />

      <g transform={`translate(${INTERNET.x} ${INTERNET.y})`}>
        <circle r="24" fill="#0c0f13" stroke="#3a4150" strokeWidth="1.5" />
        <g color="#c9ced8">
          <IconG name="globe" x={0} y={0} size={24} stroke={1.5} />
        </g>
        <text x="36" y="5" className="kf-label">Internet</text>
      </g>

      <g transform={`translate(${SWITCH.x} ${SWITCH.y})`}>
        <rect x="-50" y="-14" width="100" height="28" rx="4" fill="#0f1318" stroke="#3a4150" strokeWidth="1.5" />
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i}>
            <rect x={-40 + i * 13.5} y="-5" width="9" height="7" rx="1" fill="#05070a" stroke="#2a313c" strokeWidth="0.8" />
            <circle cx={-35.5 + i * 13.5} cy="6.5" r="1.2" fill="#5fd08a" opacity={0.3 + 0.7 * wave(t + i * 170, 900)} />
          </g>
        ))}
      </g>

      {NODES.map((node, i) => {
        const arrived = t >= ARRIVALS[i]
        const color = arrived ? STATUS_COLOR[node.status] : '#3a4150'
        const ping = span(t, ARRIVALS[i], ARRIVALS[i] + 700, ease.out)
        const flash = bump(t, ARRIVALS[i] - 40, ARRIVALS[i] + 260)
        const labelX = node.side === 'left' ? -42 : node.side === 'right' ? 42 : 0
        const anchor = node.side === 'left' ? 'end' : node.side === 'right' ? 'start' : 'middle'
        const labelY = node.side ? -3 : 52
        return (
          <g key={node.id} transform={`translate(${node.p.x} ${node.p.y})`}>
            {arrived && ping < 1 && <circle r={27 + 34 * ping} fill="none" stroke={color} strokeWidth="1.5" opacity={0.7 * (1 - ping)} />}
            {arrived && <circle r="44" fill={color} opacity="0.07" />}
            <circle r="27" fill="#0c0f13" stroke={color} strokeWidth={2 + 1.5 * flash} />
            <g color={arrived ? '#eef0f3' : '#8e97a8'}>
              <IconG name={node.icon} x={0} y={0} size={24} stroke={1.6} />
            </g>
            <text x={labelX} y={labelY} textAnchor={anchor} className="kf-label">{node.label}</text>
            <text x={labelX} y={labelY + 19} textAnchor={anchor} className="kf-verdict" fill={arrived ? color : '#6b7484'}>
              {arrived ? node.verdict : 'waiting for the mole'}
            </text>
          </g>
        )
      })}

      <g transform={`translate(${TARGET.x} ${TARGET.y})`}>
        {hit && <rect x="-50" y="-38" width="100" height="76" rx="10" fill="#ff6159" opacity={0.1 + 0.06 * wave(t, 1200)} />}
        <rect x="-34" y="-25" width="68" height="50" rx="7" fill="#0c0f13" stroke={hit ? '#ff6159' : '#3a4150'} strokeWidth="2" />
        <g color={hit ? '#ffb4ae' : '#c9ced8'}>
          <IconG name="folder" x={0} y={0} size={26} stroke={1.6} />
        </g>
        <text x="48" y="-3" className="kf-label">Client files</text>
        <text x="48" y="16" className="kf-verdict" fill={hit ? '#ff6159' : '#6b7484'}>{hit ? 'exposed to attack' : 'safe?'}</text>
      </g>

    </g>
  )
}

function Scout({ t }: { t: number }) {
  if (t < LEGS[0].start - 100) return null
  const u = legProgress(t, LEGS, ROUTE.ends)
  const p = ROUTE.at(u)
  const moving = LEGS.some((leg) => t > leg.start && t < leg.end)
  const done = t > LEGS[LEGS.length - 1].end
  const ahead = ROUTE.at(Math.min(1, u + 0.004))
  const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI
  const cone = moving ? 1 : 0.35
  return (
    <g opacity={done ? 0.85 : 1}>
      {!done && (
        <g className="kf-glow" transform={`translate(${p.x} ${p.y}) rotate(${angle})`} opacity={0.75 * cone}>
          <polygon points="0,0 120,-25 120,25" fill="url(#kf-cone)" />
        </g>
      )}
      <Probe p={p} warm={1} bright={1} spin={t * 0.12} ring={13} scale={0.62} />
    </g>
  )
}
