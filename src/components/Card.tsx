import type { CSSProperties, ReactNode, HTMLAttributes } from 'react'

const PADDING: Record<'sm' | 'md' | 'lg', string> = {
  sm: '12px 14px',
  md: '16px',
  lg: '20px',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Padding preset — sm: 12/14, md: 16, lg: 20. Defaults to md. */
  padding?: 'sm' | 'md' | 'lg'
  /** Highlights border with var(--color-primary) — replaces the 1.5px emphasis pattern. */
  selected?: boolean
  /** Override surface background (default: var(--surface-card)). */
  background?: string
  /** Override border color (default: var(--border-card), or --color-primary when selected). */
  borderColor?: string
  children: ReactNode
}

/**
 * Shared card surface — owns border (always 1px solid), radius (always var(--radius-card)),
 * surface background, and padding presets. Passes all remaining div attributes through so
 * interactive cards (role="button", onClick, etc.) work without a separate wrapper.
 */
export function Card({
  padding = 'md',
  selected = false,
  background,
  borderColor,
  style,
  children,
  ...rest
}: CardProps) {
  const base: CSSProperties = {
    background: background ?? 'var(--surface-card)',
    border: `1px solid ${borderColor ?? (selected ? 'var(--color-primary)' : 'var(--border-card)')}`,
    borderRadius: 'var(--radius-card)',
    padding: PADDING[padding],
    ...style,
  }
  return (
    <div style={base} {...rest}>
      {children}
    </div>
  )
}

export default Card
