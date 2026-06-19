import type { CSSProperties, ReactNode } from 'react'

type Variant = 'primary' | 'success' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: Variant
}

/**
 * Badge — small pill label. Primary (red tint) is used for the blood-type
 * badge; success/neutral are available for status chips.
 */
export function Badge({ children, variant = 'primary' }: BadgeProps) {
  const variants: Record<Variant, CSSProperties> = {
    primary: { background: 'var(--color-primary-tint)', color: 'var(--color-primary)' },
    success: { background: 'var(--color-success-tint)', color: 'var(--color-success)' },
    neutral: { background: 'var(--color-bg)', color: 'var(--text-secondary)' },
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 12px',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.2,
        ...variants[variant],
      }}
    >
      {children}
    </span>
  )
}

export default Badge
