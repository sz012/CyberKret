import { useId } from 'react'

export type MoleMood = 'calm' | 'dig' | 'happy' | 'alert'

interface FigureProps {
  mood?: MoleMood
  beam?: boolean
  gradientId: string
}

export function MoleFigure({ mood = 'calm', beam = true, gradientId }: FigureProps) {
  const lamp = mood === 'alert' ? 'var(--bad)' : 'var(--lamp)'
  return (
    <g className={`mole mole--${mood}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={lamp} stopOpacity="0.62" />
          <stop offset="1" stopColor={lamp} stopOpacity="0" />
        </linearGradient>
      </defs>
      {beam && <path className="mole__beam" d="M150 38 L240 4 L240 96 L150 46 Z" fill={`url(#${gradientId})`} />}
      <ellipse cx="80" cy="128" rx="64" ry="7" fill="var(--tunnel)" opacity="0.55" />
      {mood === 'dig' && (
        <g fill="#6b5444">
          <ellipse cx="14" cy="86" rx="5" ry="3.4" />
          <ellipse cx="6" cy="102" rx="3.6" ry="2.6" />
          <ellipse cx="22" cy="72" rx="3" ry="2.2" />
          <ellipse cx="2" cy="80" rx="2.4" ry="1.8" />
        </g>
      )}
      <path d="M18 100 q-12 1 -15 9 q9 1 17 -5z" fill="#4a3b31" />
      <path
        d="M20 100 C14 70 40 44 80 42 C106 41 124 50 134 64 C144 78 142 96 130 106 C112 120 52 122 32 114 C24 110 20 106 20 100 Z"
        fill="#5c4a3e"
      />
      <path d="M30 96 C30 70 50 52 82 48 C64 58 50 74 46 100 Z" fill="#4e3f34" opacity="0.7" />
      <ellipse cx="94" cy="102" rx="34" ry="14" fill="#6d5a4c" />
      <path
        d="M120 60 C136 57 152 65 160 73 C165 78 163 84 156 86 C146 88 131 85 121 80 Z"
        fill="#6d5a4c"
      />
      <ellipse cx="161" cy="79" rx="7.5" ry="6.4" fill="#e8a3a0" />
      <ellipse cx="163" cy="76.5" rx="2.6" ry="1.8" fill="#f6cdc8" />
      <path d="M145 85 q5 3.5 10 1" stroke="#3a2c22" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g stroke="#b09a85" strokeWidth="1.2" strokeLinecap="round" opacity="0.8">
        <path d="M151 77 L173 70" />
        <path d="M151 80 L175 80" />
        <path d="M151 83 L172 89" />
      </g>
      {mood === 'happy' ? (
        <path d="M128.5 67 q3.5 -3.6 7 0" stroke="var(--tunnel)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx="132" cy="66" rx="3.2" ry="2.6" fill="var(--tunnel)" />
          <circle cx="133.2" cy="64.9" r="0.95" fill="#f2e8db" />
        </>
      )}
      <path d="M88 53 C90 31 112 20 130 25 C143 29 149 40 147 53 Z" fill="#e2b04a" />
      <path d="M101 38 Q118 29 138 35" stroke="#f3d27e" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M83 52 Q116 59 152 50 L152 55.5 Q116 64 83 57.5 Z" fill="#c9962f" />
      <circle cx="147" cy="42" r="7.5" fill={lamp} stroke="#c9962f" strokeWidth="2.6" />
      <circle cx="146" cy="41" r="3.2" fill={mood === 'alert' ? '#ffd0c8' : '#fff6d8'} />
      <path
        d="M117 98 C125 91 140 93 142 101 C143 108 134 112 124 110 C118 108 113 103 117 98 Z"
        fill="#e8a3a0"
      />
      <g stroke="#f6d9d4" strokeWidth="2.2" strokeLinecap="round">
        <path d="M140 99 l6 -2.5" />
        <path d="M141.5 103.5 l6.5 0" />
        <path d="M139.5 108 l5.5 2.6" />
      </g>
      <ellipse cx="46" cy="115" rx="11" ry="5" fill="#d88f8c" />
    </g>
  )
}

interface MascotProps {
  mood?: MoleMood
  beam?: boolean
  className?: string
  title?: string
}

export function Mascot({ mood = 'calm', beam = true, className, title }: MascotProps) {
  const gradientId = `beam-${useId().replace(/:/g, '')}`
  return (
    <svg
      className={className}
      viewBox="0 0 240 140"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <MoleFigure mood={mood} beam={beam} gradientId={gradientId} />
    </svg>
  )
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 26" aria-hidden="true">
      <path d="M4 19c0-6.4 5.2-10.6 12.2-10.6S28.6 12.6 28.6 19H4z" fill="#5c4a3e" />
      <path d="M8.6 11.2c1.2-4.4 4.2-6.6 7.6-6.6s6.4 2.2 7.4 6.6" fill="#e2b04a" />
      <circle cx="23.6" cy="9.2" r="2.1" fill="#f5dc9f" />
      <circle cx="29" cy="16.6" r="2.6" fill="#e8a3a0" />
      <circle cx="22.4" cy="14.2" r="1.15" fill="#120d0a" />
      <path d="M0 22.5h34" stroke="#46372c" strokeWidth="2" />
    </svg>
  )
}
