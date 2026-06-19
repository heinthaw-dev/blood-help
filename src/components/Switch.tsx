import type { CSSProperties } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel?: string
}

/**
 * Toggle switch — port of the design-system Switch. 48×28 track; primary red
 * when on, muted grey when off, with a sliding white knob.
 */
export function Switch({ checked, onChange, ariaLabel }: SwitchProps) {
  const track: CSSProperties = {
    width: 48,
    height: 28,
    flexShrink: 0,
    padding: 0,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    background: checked ? 'var(--color-primary)' : 'var(--border-field)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 140ms ease',
  }
  const knob: CSSProperties = {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(26, 26, 26, 0.2)',
    transform: checked ? 'translateX(20px)' : 'translateX(0)',
    transition: 'transform 140ms ease',
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={track}
    >
      <span style={knob} />
    </button>
  )
}

export default Switch
