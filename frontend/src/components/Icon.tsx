import { iconPaths } from './iconPaths'

interface Props {
  name: string
  size?: number
  className?: string
  title?: string
}

export function Icon({ name, size = 18, className, title }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {iconPaths(name).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
