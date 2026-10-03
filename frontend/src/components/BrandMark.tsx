export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={Math.round((size * 26) / 34)} viewBox="0 0 34 26" aria-hidden="true">
      <path d="M4 19c0-6.4 5.2-10.6 12.2-10.6S28.6 12.6 28.6 19H4z" fill="#5c4a3e" />
      <path d="M8.6 11.2c1.2-4.4 4.2-6.6 7.6-6.6s6.4 2.2 7.4 6.6" fill="#e2b04a" />
      <circle cx="23.6" cy="9.2" r="2.1" fill="var(--lamp)" />
      <circle cx="29" cy="16.6" r="2.6" fill="#e8a3a0" />
      <circle cx="22.4" cy="14.2" r="1.15" fill="var(--bg)" />
      <path d="M0 22.5h34" stroke="var(--line-2)" strokeWidth="2" />
    </svg>
  )
}
