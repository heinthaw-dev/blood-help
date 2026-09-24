import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { formatNumber } from '../i18n'
import type { Lang } from '../i18n'

/** How far back the year list goes. Covers every plausible donor age. */
const YEARS_BACK = 100

const MONTH_NAMES: Record<Lang, string[]> = {
  my: [
    'ဇန်နဝါရီ',
    'ဖေဖော်ဝါရီ',
    'မတ်',
    'ဧပြီ',
    'မေ',
    'ဇွန်',
    'ဇူလိုင်',
    'ဩဂုတ်',
    'စက်တင်ဘာ',
    'အောက်တိုဘာ',
    'နိုဝင်ဘာ',
    'ဒီဇင်ဘာ',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

const PLACEHOLDERS: Record<Lang, { day: string; month: string; year: string }> = {
  my: { day: 'ရက်', month: 'လ', year: 'ခုနှစ်' },
  en: { day: 'Day', month: 'Month', year: 'Year' },
}

/** Last day of `month` (1-12) in `year` — day 0 of the next month. Handles leap Februaries. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Zero-pad to two digits for the ISO string. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

type Field = 'day' | 'month' | 'year'

interface DateOfBirthPickerProps {
  /** ISO `YYYY-MM-DD`, or null while the date is still incomplete. */
  value: string | null
  /** Fires with the ISO date once all three parts are chosen, else null. */
  onChange: (value: string | null) => void
  lang: Lang
}

/**
 * Date-of-birth picker — three native selects (Day · Month · Year).
 *
 * Native `<input type="date">` opens its calendar on today, so a donor picking a
 * birth date has to scroll back thirty-odd years every time. Three dropdowns let
 * them jump straight to the year, render as the OS wheel on iOS and a native list
 * on Android, and carry Burmese month names and numerals — which the OS calendar
 * would not.
 *
 * The day list clamps to the chosen month, so 31 February cannot be expressed:
 * switching to a shorter month clears an out-of-range day rather than silently
 * shifting the date.
 */
export function DateOfBirthPicker({ value, onChange, lang }: DateOfBirthPickerProps) {
  // 0 means "not chosen yet". The parts live here rather than being derived from
  // `value`, because `value` stays null until all three are set.
  const [day, setDay] = useState(() => (value ? Number(value.slice(8, 10)) : 0))
  const [month, setMonth] = useState(() => (value ? Number(value.slice(5, 7)) : 0))
  const [year, setYear] = useState(() => (value ? Number(value.slice(0, 4)) : 0))
  const [focused, setFocused] = useState<Field | null>(null)

  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const months = MONTH_NAMES[lang]
  const placeholder = PLACEHOLDERS[lang]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: YEARS_BACK }, (_, i) => currentYear - i)

  // Before a year is chosen, count days against a leap year so 29 February stays
  // selectable; picking a non-leap year afterwards clears it through the same
  // clamp every other change goes through.
  const dayCount = month ? daysInMonth(year || 2024, month) : 31
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  /** Apply a new part, clamp the day to the resulting month, and emit. */
  const commit = (next: { day?: number; month?: number; year?: number }) => {
    const y = next.year ?? year
    const m = next.month ?? month
    let d = next.day ?? day

    // Dropping to a shorter month invalidates a high day — clear it instead of
    // rolling over into the next month.
    if (m && d > daysInMonth(y || 2024, m)) d = 0

    setYear(y)
    setMonth(m)
    setDay(d)
    onChange(y && m && d ? `${y}-${pad(m)}-${pad(d)}` : null)
  }

  const selectStyle = (field: Field, filled: boolean): CSSProperties => ({
    width: '100%',
    height: 52,
    // Right padding leaves room for the chevron drawn over the select.
    padding: '0 32px 0 14px',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: '#fff',
    border: `1px solid ${focused === field ? 'var(--focus-ring)' : 'var(--border-field)'}`,
    borderRadius: 'var(--radius-input)',
    fontFamily: bodyFont,
    fontSize: 16,
    color: filled ? 'var(--text-primary)' : 'var(--text-hint)',
    outline: 'none',
    boxShadow: focused === field ? '0 0 0 3px var(--color-primary-wash)' : 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  })

  const chevronStyle: CSSProperties = {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    // The select underneath owns the taps — the chevron is decoration only.
    pointerEvents: 'none',
    fontSize: 11,
    lineHeight: 1,
    color: 'var(--text-hint)',
  }

  /** One select plus its decorative chevron. */
  const field = (node: ReactNode) => (
    <div style={{ position: 'relative', minWidth: 0 }}>
      {node}
      <span style={chevronStyle} aria-hidden="true">
        ▾
      </span>
    </div>
  )

  return (
    <div
      style={{
        display: 'grid',
        // Month carries the longest labels (ဖေဖော်ဝါရီ / September), so it gets the
        // widest column; minmax(0,…) lets all three shrink on a 320px phone.
        gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.5fr) minmax(0, 1fr)',
        gap: 10,
      }}
    >
      {field(
        <select
          aria-label={placeholder.day}
          value={day || ''}
          onChange={(e) => commit({ day: Number(e.target.value) })}
          onFocus={() => setFocused('day')}
          onBlur={() => setFocused(null)}
          style={selectStyle('day', day > 0)}
        >
          <option value="" disabled>
            {placeholder.day}
          </option>
          {days.map((d) => (
            <option key={d} value={d}>
              {formatNumber(d, lang)}
            </option>
          ))}
        </select>,
      )}

      {field(
        <select
          aria-label={placeholder.month}
          value={month || ''}
          onChange={(e) => commit({ month: Number(e.target.value) })}
          onFocus={() => setFocused('month')}
          onBlur={() => setFocused(null)}
          style={selectStyle('month', month > 0)}
        >
          <option value="" disabled>
            {placeholder.month}
          </option>
          {months.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>,
      )}

      {field(
        <select
          aria-label={placeholder.year}
          value={year || ''}
          onChange={(e) => commit({ year: Number(e.target.value) })}
          onFocus={() => setFocused('year')}
          onBlur={() => setFocused(null)}
          style={selectStyle('year', year > 0)}
        >
          <option value="" disabled>
            {placeholder.year}
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {formatNumber(y, lang)}
            </option>
          ))}
        </select>,
      )}
    </div>
  )
}

export default DateOfBirthPicker
