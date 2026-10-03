// Line icons in a 24×24 box, stroke = currentColor.
const P: Record<string, string> = {
  router: 'M3 14h18v5H3z M7 16.5h.01 M10 16.5h.01 M6 14l-1-6 M18 14l1-6 M9 9a4 4 0 0 1 6 0 M7 6.5a7 7 0 0 1 10 0',
  laptop: 'M4 5h16v11H4z M2 19h20 M9 19l1-3h4l1 3',
  key: 'M14 4a6 6 0 1 1-4.6 9.8L3 20.2V17h3v-3h3l.6-.6A6 6 0 0 1 14 4z M16.5 7.5h.01',
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  coins: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  disk: 'M4 4h16v6H4z M4 14h16v6H4z M7 7h.01 M7 17h.01 M11 7h6 M11 17h6',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9',
  folder: 'M3 6h6l2 2h10v11H3z',
  money: 'M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M6 10v4 M18 10v4',
  briefcase: 'M3 8h18v12H3z M9 8V5h6v3 M3 13h18',
  cloud: 'M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  shield: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  check: 'M5 12l5 5 9-10',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  wifiOff: 'M2 8a15 15 0 0 1 6-3.2 M22 8a15 15 0 0 0-9.5-3.9 M5 12a10 10 0 0 1 3.5-2 M19 12a10 10 0 0 0-3-1.8 M8.5 15.5a5 5 0 0 1 7 0 M12 19h.01 M3 3l18 18',
  copy: 'M8 8h12v12H8z M4 16V4h12',
  chip: 'M7 7h10v10H7z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  paperclip: 'M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
}

export function Icon({ name, size = 20, stroke = 1.8, className }: { name: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.shield} />
    </svg>
  )
}

/** Same icon as an SVG group, for use inside another SVG. */
export function IconG({ name, x, y, size = 24, stroke = 1.8 }: { name: string; x: number; y: number; size?: number; stroke?: number }) {
  const s = size / 24
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] ?? P.shield} />
    </g>
  )
}
