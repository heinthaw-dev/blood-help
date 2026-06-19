import type { CSSProperties, ReactNode } from 'react'
import { Switch } from '../components/Switch'
import { Badge } from '../components/Badge'
import { BottomNav } from '../components/BottomNav'
import type { Tab } from '../components/BottomNav'
import type { BloodType } from '../blood'
import type { Lang } from '../i18n'

interface ProfileProps {
  lang: Lang
  /** App-wide language switch — this screen is where the global setting lives. */
  onLangChange: (lang: Lang) => void
  name: string
  bloodType: BloodType
  donationCount: number
  /** Display string for the last donation date, or null if never donated. */
  lastDonation: string | null
  available: boolean
  onAvailableChange: (v: boolean) => void
  showNumber: boolean
  onShowNumberChange: (v: boolean) => void
  onEditProfile: () => void
  onLogout: () => void
  onNavigate: (tab: Tab) => void
}

export function Profile({
  lang,
  onLangChange,
  name,
  bloodType,
  donationCount,
  lastDonation,
  available,
  onAvailableChange,
  showNumber,
  onShowNumberChange,
  onEditProfile,
  onLogout,
  onNavigate,
}: ProfileProps) {
  const isMy = lang === 'my'
  const bodyFont = isMy ? 'var(--font-burmese)' : 'var(--font-sans)'
  const lh = isMy ? 1.7 : 1.45

  const t = {
    my: {
      title: 'ပရိုဖိုင်',
      donated: (n: number) => `လှူဒါန်းမှု ${n} ကြိမ်`,
      lastDonation: (d: string) => `နောက်ဆုံး လှူဒါန်းသည့်ရက် — ${d}`,
      lastDonationNone: 'နောက်ဆုံး လှူဒါန်းသည့်ရက် — မရှိသေးပါ',
      available: 'သွေးလှူရန် အသင့်ရှိသည်',
      showNumber: 'ကျွန်ုပ်၏ နံပါတ်ကို တောင်းခံသူများအား ပြသမည်',
      language: 'ဘာသာစကား',
      editProfile: 'ပရိုဖိုင် ပြင်ဆင်ရန်',
      logout: 'ထွက်ရန်',
    },
    en: {
      title: 'Profile',
      donated: (n: number) => `Donated ${n} times`,
      lastDonation: (d: string) => `Last donation — ${d}`,
      lastDonationNone: 'Last donation — none yet',
      available: 'Available to donate',
      showNumber: 'Show my number to requesters',
      language: 'Language',
      editProfile: 'Edit profile',
      logout: 'Log out',
    },
  }[lang]

  const initial = (name.trim()[0] || '?').toUpperCase()

  const rowLabelStyle: CSSProperties = {
    flex: 1,
    margin: 0,
    fontFamily: bodyFont,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: lh,
    color: 'var(--text-primary)',
  }

  const segBase: CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    border: 'none',
    borderRadius: 'var(--radius-pill)',
    padding: '7px 14px',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  }
  const segActive: CSSProperties = { ...segBase, background: 'var(--color-primary)', color: '#fff' }
  const segIdle: CSSProperties = { ...segBase, background: 'transparent', color: 'var(--text-secondary)' }

  // A settings row container (white surface, padded).
  const row = (children: ReactNode, onClick?: () => void) => (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px',
        background: 'var(--surface-card)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  )

  const divider = <div style={{ height: 1, background: 'var(--border-card)', marginLeft: 16 }} />

  return (
    <div className="phone-entry-stage">
      <div className="phone-entry-card" style={{ height: '100dvh' }}>
        {/* Header bar */}
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-card)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: bodyFont,
              fontSize: 18,
              fontWeight: 600,
              lineHeight: isMy ? 1.55 : 1.3,
              color: 'var(--text-primary)',
            }}
          >
            {t.title}
          </h2>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {/* Identity header */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '28px 24px 24px',
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                background: 'var(--color-primary-tint)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-sans)',
                fontSize: 34,
                fontWeight: 600,
                color: 'var(--color-primary)',
              }}
            >
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: bodyFont,
                  fontSize: 22,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                }}
              >
                {name}
              </p>
              <Badge>{bloodType}</Badge>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              margin: '0 16px',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-soft)',
              overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, padding: '16px 12px', textAlign: 'center' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  lineHeight: 1.2,
                }}
              >
                {donationCount}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontFamily: bodyFont,
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: lh,
                  color: 'var(--text-secondary)',
                }}
              >
                {t.donated(donationCount)}
              </p>
            </div>
            <div style={{ width: 1, background: 'var(--border-card)' }} />
            <div
              style={{
                flex: 1,
                padding: '16px 12px',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: bodyFont,
                  fontSize: 13,
                  fontWeight: 400,
                  lineHeight: lh,
                  color: 'var(--text-secondary)',
                }}
              >
                {lastDonation ? t.lastDonation(lastDonation) : t.lastDonationNone}
              </p>
            </div>
          </div>

          {/* Settings list */}
          <div
            style={{
              margin: '20px 16px 0',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-soft)',
              overflow: 'hidden',
            }}
          >
            {row(
              <>
                <p style={rowLabelStyle}>{t.available}</p>
                <Switch checked={available} onChange={onAvailableChange} ariaLabel={t.available} />
              </>,
            )}
            {divider}
            {row(
              <>
                <p style={rowLabelStyle}>{t.showNumber}</p>
                <Switch checked={showNumber} onChange={onShowNumberChange} ariaLabel={t.showNumber} />
              </>,
            )}
            {divider}
            {row(
              <>
                <p style={rowLabelStyle}>{t.language}</p>
                <div
                  style={{
                    display: 'inline-flex',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-pill)',
                    padding: 3,
                    gap: 2,
                    flex: 'none',
                  }}
                >
                  <button type="button" onClick={() => onLangChange('my')} style={isMy ? segActive : segIdle}>
                    မြန်မာ
                  </button>
                  <button type="button" onClick={() => onLangChange('en')} style={isMy ? segIdle : segActive}>
                    ENG
                  </button>
                </div>
              </>,
            )}
            {divider}
            {row(
              <>
                <p style={rowLabelStyle}>{t.editProfile}</p>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-hint)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </>,
              onEditProfile,
            )}
          </div>

          {/* Log out */}
          <div style={{ padding: '24px 16px 28px' }}>
            <button
              type="button"
              onClick={onLogout}
              style={{
                width: '100%',
                height: 50,
                background: 'var(--surface-card)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-button)',
                cursor: 'pointer',
                fontFamily: bodyFont,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-primary)',
              }}
            >
              {t.logout}
            </button>
          </div>
        </div>

        {/* Bottom nav */}
        <BottomNav active="profile" lang={lang} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export default Profile
