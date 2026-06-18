import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { useState } from 'react'

type Variant = 'primary' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Full width + fixed height, e.g. the Phone Entry CTA at 54px. */
  fullWidth?: boolean
  height?: number
}

/**
 * Primary / secondary action button — port of the Blood Help design-system
 * `Button` component. Primary uses the loud red with the lifting CTA shadow.
 */
export function Button({
  variant = 'primary',
  fullWidth = false,
  height = 54,
  disabled = false,
  style,
  children,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)

  const base: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    height,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 20px',
    border: 'none',
    borderRadius: 'var(--radius-button)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--type-button-size)',
    fontWeight: 600,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  }

  let variantStyle: CSSProperties
  if (variant === 'primary') {
    const bg = active
      ? 'var(--color-primary-press)'
      : hover
        ? 'var(--color-primary-hover)'
        : 'var(--color-primary)'
    variantStyle = {
      background: bg,
      color: 'var(--text-on-primary)',
      boxShadow: disabled ? 'none' : 'var(--shadow-cta)',
      opacity: disabled ? 0.45 : 1,
    }
  } else {
    variantStyle = {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-card)',
      opacity: disabled ? 0.45 : 1,
    }
  }

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setActive(false)
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{ ...base, ...variantStyle, ...style }}
    >
      {children}
    </button>
  )
}

export default Button
