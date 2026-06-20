import type { CSSProperties, ReactNode } from 'react'

type Variant = 'primary' | 'success' | 'neutral'
type Size = 'sm' | 'lg'

interface BadgeProps {
  children: ReactNode
  variant?: Variant
  /** `sm` (default) is the inline status pill; `lg` is the hero blood-type chip. */
  size?: Size
}

/**
 * Badge — pill label. Primary (red tint) is used for the blood-type badge;
 * success/neutral are available for status chips. `size="lg"` renders the larger
 * hero blood-type chip used at the top of a request screen.
 */
export function Badge({ children, variant = 'primary', size = 'sm' }: BadgeProps) {
  const variants: Record<Variant, CSSProperties> = {
    primary: { background: 'var(--color-primary-tint)', color: 'var(--color-primary)' },
    success: { background: 'var(--color-success-tint)', color: 'var(--color-success)' },
    neutral: { background: 'var(--color-bg)', color: 'var(--text-secondary)' },
  }

  const sizes: Record<Size, CSSProperties> = {
    sm: { padding: '4px 12px', fontSize: 14, borderRadius: 'var(--radius-pill)' },
    lg: { padding: '10px 18px', fontSize: 22, borderRadius: 'var(--radius-card)' },
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        lineHeight: 1.2,
        ...sizes[size],
        ...variants[variant],
      }}
    >
      {children}
    </span>
  )
}

export default Badge
