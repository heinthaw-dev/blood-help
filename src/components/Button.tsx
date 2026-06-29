import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { useState } from 'react'

/** Color mood — determines background, shadow, and icon tint. */
export type Tone = 'primary' | 'secondary' | 'success' | 'danger'

/** @deprecated Use `tone` instead. Kept for backward compatibility. */
type Variant = Tone

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Color mood. Maps to design-system tokens. Replaces deprecated `variant`. */
  tone?: Tone
  /** @deprecated Alias for `tone`. */
  variant?: Variant
  /** Full width + fixed height (default 54px). */
  fullWidth?: boolean
  height?: number
  /** Optional leading icon (ReactNode — pass an <svg> or <img>). */
  icon?: ReactNode
  /** Optional trailing icon (e.g. chevron-right). */
  trailingIcon?: ReactNode
  /** When set, renders an <a> tag instead of <button> (e.g. `tel:` links). */
  href?: string
}

/**
 * Action button — the single source of truth for Blood Help's CTAs.
 *
 * - **54 px tall / 16·600** by default — the design-system standard.
 * - `tone` selects the color mood (primary red, neutral secondary, success
 *   green, danger red-on-neutral).
 * - `icon` / `trailingIcon` slot inline SVGs before / after the label.
 * - `href` renders an `<a>` tag (for `tel:` links etc.) while keeping the
 *   same visual treatment.
 */
export function Button({
  tone,
  variant,
  fullWidth = false,
  height = 54,
  disabled = false,
  icon,
  trailingIcon,
  href,
  style,
  children,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)

  // Resolve tone: explicit `tone` wins, fall back to deprecated `variant`, default 'primary'.
  const resolved: Tone = tone ?? variant ?? 'primary'

  const gap = icon || trailingIcon ? 8 : 0

  // ── Base styles (shared across all tones) ──────────────────────────────
  const base: CSSProperties = {
    width: fullWidth ? '100%' : undefined,
    height,
    // Pin the declared height: as a flex item in a column container (e.g. the
    // Profile scroll area) the default flex-shrink:1 would squash the button
    // below `height` when content overflows. No-op outside flex contexts.
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap,
    padding: '0 20px',
    border: 'none',
    borderRadius: 'var(--radius-button)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--type-button-size, 16px)',
    fontWeight: 600,
    lineHeight: 1,
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition:
      'background 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  }

  // ── Tone-specific styles ───────────────────────────────────────────────
  let toneStyle: CSSProperties

  switch (resolved) {
    case 'primary':
      toneStyle = {
        background: active
          ? 'var(--color-primary-press)'
          : hover
            ? 'var(--color-primary-hover)'
            : 'var(--color-primary)',
        color: 'var(--text-on-primary)',
        boxShadow: disabled ? 'none' : 'var(--shadow-cta)',
        opacity: disabled ? 0.45 : 1,
      }
      break

    case 'success':
      toneStyle = {
        background: active
          ? 'var(--color-success-press)'
          : hover
            ? 'var(--color-success-hover)'
            : 'var(--color-success)',
        color: 'var(--text-on-primary)',
        boxShadow: disabled ? 'none' : 'var(--shadow-cta-success)',
        opacity: disabled ? 0.45 : 1,
      }
      break

    case 'danger':
      toneStyle = {
        background: active
          ? 'var(--color-primary-press)'
          : hover
            ? 'var(--color-primary-wash)'
            : 'var(--surface-card)',
        color: hover || active ? 'var(--color-primary)' : 'var(--text-secondary)',
        border: '1px solid var(--border-field)',
        opacity: disabled ? 0.45 : 1,
      }
      break

    default:
      // secondary
      toneStyle = {
        background: 'var(--surface-card)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-card)',
        opacity: disabled ? 0.45 : 1,
      }
      break
  }

  // ── Icon tint ──────────────────────────────────────────────────────────
  const iconColor =
    resolved === 'primary' || resolved === 'success'
      ? 'var(--text-on-primary)'
      : resolved === 'danger'
        ? hover || active ? 'var(--color-primary)' : 'var(--text-secondary)'
        : 'currentColor'

  const iconStyle: CSSProperties = {
    display: 'block',
    flexShrink: 0,
    color: iconColor,
  }

  // ── Mouse handlers (shared) ────────────────────────────────────────────
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false)
      setActive(false)
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
  }

  const merged = { ...base, ...toneStyle, ...style }

  // ── Render as <a> when href is provided ────────────────────────────────
  if (href) {
    return (
      <a
        {...handlers}
        href={href}
        aria-disabled={disabled || undefined}
        style={merged}
      >
        {icon && <span style={iconStyle}>{icon}</span>}
        {children}
        {trailingIcon && <span style={iconStyle}>{trailingIcon}</span>}
      </a>
    )
  }

  return (
    <button
      {...rest}
      {...handlers}
      disabled={disabled}
      style={merged}
    >
      {icon && <span style={iconStyle}>{icon}</span>}
      {children}
      {trailingIcon && <span style={iconStyle}>{trailingIcon}</span>}
    </button>
  )
}

export default Button
