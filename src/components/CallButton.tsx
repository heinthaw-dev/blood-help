import { useState } from 'react'

type Shape = 'round' | 'bar'

interface CallButtonProps {
  /** `tel:` phone number. */
  href: string
  /** Optional click handler (e.g. to record a response before dialing). */
  onClick?: () => void
  /** `round` (default) = 48 px circle; `bar` = full-width 54 px CTA. */
  shape?: Shape
  /** Visible label for `shape="bar"`. Ignored for `round`. */
  children?: React.ReactNode
}

/** Inline phone icon — white stroke, sized to fit either shape. */
function PhoneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

/**
 * CallButton — the standard round red `tel:` affordance.
 *
 * - **`shape="round"`** (default) — 48 px circle with `--shadow-cta` and
 *   hover/press states. Used inline inside responder/caller list rows.
 * - **`shape="bar"`** — full-width 54 px CTA with a phone icon + label.
 *   Used in FCM alert overlays.
 *
 * Both shapes render as `<a href="tel:...">` so the native dialer opens
 * on tap.
 */
export function CallButton({ href, onClick, shape = 'round', children }: CallButtonProps) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)
  const bg = active
    ? 'var(--color-primary-press)'
    : hover
      ? 'var(--color-primary-hover)'
      : 'var(--color-primary)'

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => { setHover(false); setActive(false) },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
  }

  if (shape === 'bar') {
    return (
      <a
        href={href}
        onClick={onClick}
        {...handlers}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          width: '100%',
          height: 54,
          border: 'none',
          borderRadius: 'var(--radius-button)',
          background: bg,
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'var(--font-burmese)',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: 1,
          cursor: 'pointer',
          boxShadow: 'var(--shadow-cta)',
          transition: 'background 120ms ease',
        }}
      >
        <PhoneIcon />
        {children}
      </a>
    )
  }

  return (
    <a
      href={href}
      aria-label="ဖုန်းခေါ်ရန်"
      onClick={onClick}
      {...handlers}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        borderRadius: '999px',
        background: bg,
        textDecoration: 'none',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-cta)',
        transition: 'background 120ms ease, transform 80ms ease',
        transform: active ? 'scale(0.97)' : 'none',
      }}
    >
      <PhoneIcon />
    </a>
  )
}

export default CallButton
