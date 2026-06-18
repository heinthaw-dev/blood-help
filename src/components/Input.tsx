import type { CSSProperties, InputHTMLAttributes } from 'react'
import { useState } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  /** Leading prefix chip, e.g. "+95". */
  prefix?: string
}

/**
 * Text input — port of the design-system Input. Optional leading prefix chip
 * (e.g. country code), 52px tall, red focus ring matching the other fields.
 */
export function Input({ prefix, style, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false)

  const fieldStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    height: 52,
    padding: '0 16px',
    background: '#fff',
    border: `1px solid ${focus ? 'var(--focus-ring)' : 'var(--border-field)'}`,
    borderRadius: 'var(--radius-input)',
    fontFamily: 'var(--font-sans)',
    fontSize: 16,
    color: 'var(--text-primary)',
    outline: 'none',
    boxShadow: focus ? '0 0 0 3px var(--color-primary-wash)' : 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    ...style,
  }

  const input = (
    <input
      {...rest}
      onFocus={(e) => {
        setFocus(true)
        rest.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocus(false)
        rest.onBlur?.(e)
      }}
      style={fieldStyle}
    />
  )

  if (!prefix) return input

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 52,
          padding: '0 16px',
          background: '#fff',
          border: '1px solid var(--border-field)',
          borderRadius: 'var(--radius-input)',
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          flex: 'none',
        }}
      >
        {prefix}
      </div>
      {input}
    </div>
  )
}

export default Input
