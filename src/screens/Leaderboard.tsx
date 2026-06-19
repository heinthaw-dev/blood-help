import type { CSSProperties } from 'react'
import { BottomNav } from '../components/BottomNav'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'
import { formatNumber } from '../i18n'

interface LeaderboardEntry {
  rank: number
  name: string
  initial: string
  bloodType: string
  count: number
  isUser?: boolean
}

interface LeaderboardProps {
  lang: Lang
  onNavigate: (tab: Tab) => void
  /** Current user — used to personalize the highlighted "You" row. */
  userName: string
  userBloodType: BloodType
}

/** Dummy leaderboard data (top donors). Real ranking is a later phase. */
const DUMMY: LeaderboardEntry[] = [
  { rank: 1, name: 'အောင်ကို', initial: 'အ', bloodType: 'O+', count: 42 },
  { rank: 2, name: 'လှလှဝင်း', initial: 'လ', bloodType: 'B+', count: 38 },
  { rank: 3, name: 'စုစုနိုင်', initial: 'စ', bloodType: 'A+', count: 35 },
  { rank: 4, name: 'မင်းသူ', initial: 'မ', bloodType: 'O−', count: 29 },
  { rank: 5, name: 'ခိုင်ဇော်', initial: 'ခ', bloodType: 'AB+', count: 24 },
  { rank: 6, name: 'သီတာ', initial: 'သ', bloodType: 'B−', count: 19 },
  { rank: 7, name: 'သင်', initial: 'သ', bloodType: 'O+', count: 12, isUser: true },
  { rank: 8, name: 'ဇင်မာ', initial: 'ဇ', bloodType: 'A−', count: 9 },
]

export function Leaderboard({ lang, onNavigate, userName, userBloodType }: LeaderboardProps) {
  const isMy = lang === 'my'
  const burmeseFont = 'var(--font-burmese)'

  const t = {
    my: { subtitle: 'လူ့အသက်များ ကယ်တင်ခဲ့သူများ', sub2: "People who've saved lives", times: 'ကြိမ်', you: 'သင်' },
    en: { subtitle: "People who've saved lives", sub2: 'လူ့အသက်များ ကယ်တင်ခဲ့သူများ', times: 'times', you: 'You' },
  }[lang]

  // Personalize the highlighted row with the logged-in user.
  const rows = DUMMY.map((d) =>
    d.isUser
      ? { ...d, name: userName, initial: (userName.trim()[0] || 'သ').toUpperCase(), bloodType: userBloodType }
      : d,
  )

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ height: '100dvh' }}>
        {/* Header */}
        <div style={{ flex: 'none', padding: '26px 20px 16px', background: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="22" height="26" viewBox="0 0 24 28" fill="none" style={{ display: 'block' }}>
              <path d="M12 1.5s9 9 9 15.5a9 9 0 0 1-18 0C3 10.5 12 1.5 12 1.5z" fill="var(--color-primary)" />
            </svg>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Blood Help
            </span>
          </div>
          <p
            style={{
              margin: '18px 0 0',
              fontFamily: isMy ? burmeseFont : 'var(--font-sans)',
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
            }}
          >
            {t.subtitle}
          </p>
          <div
            style={{
              fontFamily: isMy ? 'var(--font-sans)' : burmeseFont,
              fontSize: 13,
              color: 'var(--text-hint)',
              marginTop: 1,
            }}
          >
            {t.sub2}
          </div>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none', padding: '6px 20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => {
              const top = row.rank <= 3
              const rowStyle: CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                borderRadius: 'var(--radius-card)',
                background: row.isUser ? 'var(--color-primary-tint)' : 'var(--surface-card)',
                border: `1px solid ${row.isUser ? 'transparent' : 'var(--border-card)'}`,
              }
              return (
                <div key={row.rank} style={rowStyle}>
                  {/* rank */}
                  <div
                    style={{
                      width: 30,
                      flex: 'none',
                      textAlign: 'center',
                      fontFamily: 'var(--font-sans)',
                      fontSize: top ? 20 : 15,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: top ? 'var(--color-primary)' : 'var(--text-hint)',
                    }}
                  >
                    {formatNumber(row.rank, lang)}
                  </div>
                  {/* avatar */}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      flex: 'none',
                      borderRadius: 999,
                      background: row.isUser ? 'var(--surface-card)' : 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: burmeseFont,
                      fontSize: 15,
                      fontWeight: 600,
                      color: row.isUser ? 'var(--color-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {row.initial}
                  </div>
                  {/* name + badges */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: burmeseFont,
                        fontSize: 16,
                        fontWeight: row.isUser ? 600 : 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.name}
                    </span>
                    {row.isUser && (
                      <span
                        style={{
                          flex: 'none',
                          fontFamily: isMy ? burmeseFont : 'var(--font-sans)',
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1,
                          color: '#fff',
                          background: 'var(--color-primary)',
                          borderRadius: 'var(--radius-pill)',
                          padding: '4px 9px',
                        }}
                      >
                        {t.you}
                      </span>
                    )}
                    <span
                      style={{
                        flex: 'none',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1,
                        color: 'var(--color-primary)',
                        background: 'var(--color-primary-tint)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px 8px',
                      }}
                    >
                      {row.bloodType}
                    </span>
                  </div>
                  {/* count */}
                  <div style={{ flex: 'none', textAlign: 'right' }}>
                    <span style={{ fontFamily: burmeseFont, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatNumber(row.count, lang)}
                    </span>
                    <span style={{ fontFamily: burmeseFont, fontSize: 16, color: 'var(--text-secondary)' }}>
                      {' '}
                      {t.times}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom nav */}
        <BottomNav active="leaderboard" lang={lang} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export default Leaderboard
