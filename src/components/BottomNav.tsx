import type { CSSProperties, ReactNode } from 'react'
import type { Lang } from '../i18n'

export type Tab = 'home' | 'leaderboard' | 'profile'

interface BottomNavProps {
  active: Tab
  lang: Lang
  onNavigate: (tab: Tab) => void
}

const LABELS: Record<Tab, Record<Lang, string>> = {
  home: { my: 'ပင်မ', en: 'Home' },
  leaderboard: { my: 'ထိပ်တန်း', en: 'Leaderboard' },
  profile: { my: 'ပရိုဖိုင်', en: 'Profile' },
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  )
}
function LeaderboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="4" y="13" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <rect x="16" y="5" width="4" height="15" rx="1" />
    </svg>
  )
}
function ProfileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  )
}

const ICONS: Record<Tab, ReactNode> = {
  home: <HomeIcon />,
  leaderboard: <LeaderboardIcon />,
  profile: <ProfileIcon />,
}

const TABS: Tab[] = ['home', 'leaderboard', 'profile']

/**
 * Bottom tab bar — Home · Leaderboard · Profile. Active tab is primary red,
 * inactive tabs are muted grey.
 */
export function BottomNav({ active, lang, onNavigate }: BottomNavProps) {
  const item = (selected: boolean): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: selected ? 'var(--color-primary)' : 'var(--text-hint)',
    transition: 'color 120ms ease',
  })

  return (
    <nav
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'stretch',
        padding: '6px 8px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-card)',
      }}
    >
      {TABS.map((t) => {
        const selected = t === active
        return (
          <button key={t} type="button" onClick={() => onNavigate(t)} style={item(selected)} aria-current={selected ? 'page' : undefined}>
            {ICONS[t]}
            <span
              style={{
                fontFamily: lang === 'my' ? 'var(--font-burmese)' : 'var(--font-sans)',
                fontSize: 11,
                fontWeight: selected ? 600 : 500,
                lineHeight: 1.2,
              }}
            >
              {LABELS[t][lang]}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
