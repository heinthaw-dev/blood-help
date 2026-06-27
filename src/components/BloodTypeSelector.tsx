import type { CSSProperties } from 'react'
import { BLOOD_TYPES } from '../blood'
import type { BloodType } from '../blood'

interface BloodTypeSelectorProps {
  value: BloodType | null
  onChange: (type: BloodType) => void
}

/**
 * Blood-type selector — port of the design-system BloodTypeSelector.
 * 8 pill chips in a 4-column grid, single-select. Selected chip goes primary
 * red; idle chips are quiet outlined pills.
 */
export function BloodTypeSelector({ value, onChange }: BloodTypeSelectorProps) {
  const chip = (selected: boolean): CSSProperties => ({
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-pill)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
    background: selected ? 'var(--color-primary)' : 'var(--surface-card)',
    color: selected ? '#fff' : 'var(--text-primary)',
    border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border-field)'}`,
  })

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}
    >
      {BLOOD_TYPES.map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)} style={chip(value === t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export default BloodTypeSelector
