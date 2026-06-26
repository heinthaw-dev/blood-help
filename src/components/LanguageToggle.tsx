import type { CSSProperties } from 'react'
import type { Lang } from '../i18n'

interface LanguageToggleProps {
  lang: Lang
  onChange: (lang: Lang) => void
  /**
   * Track (container) background. `surface` (#fff) is the header default; `bg`
   * (`--color-bg`) matches the Profile Settings card so the toggle keeps its
   * inset look there. Pill styling is identical either way.
   */
  track?: 'surface' | 'bg'
}

const tabBase: CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  fontWeight: 600,
  lineHeight: 1,
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  padding: '7px 12px',
  cursor: 'pointer',
  transition: 'background 120ms ease, color 120ms ease',
}
const activeTab: CSSProperties = { ...tabBase, background: 'var(--color-primary)', color: '#fff' }
const idleTab: CSSProperties = { ...tabBase, background: 'transparent', color: 'var(--text-secondary)' }

/**
 * Language toggle — the မြန်မာ/ENG segmented pill shared by every screen's header
 * (and the Profile Settings row). Single source of truth for the toggle that was
 * previously copy-pasted inline across six screens.
 */
export function LanguageToggle({ lang, onChange, track = 'surface' }: LanguageToggleProps) {
  const isMy = lang === 'my'
  return (
    <div
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        background: track === 'bg' ? 'var(--color-bg)' : '#fff',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--radius-pill)',
        padding: 3,
        gap: 2,
      }}
    >
      <button type="button" onClick={() => onChange('my')} style={isMy ? activeTab : idleTab}>
        မြန်မာ
      </button>
      <button type="button" onClick={() => onChange('en')} style={isMy ? idleTab : activeTab}>
        ENG
      </button>
    </div>
  )
}

export default LanguageToggle
